#!/usr/bin/env bash
# Release production an toàn cho my-task.service (build thư mục mới → smoke → promote).
#
#   scripts/agent/release.sh status [--smoke]          # dist đang chạy, các release, marker
#   scripts/agent/release.sh build [--label x]         # build .next-release-<label>-<ts>, start tạm, smoke
#   scripts/agent/release.sh promote <dir> [--schema-ok] [--dry-run]
#   scripts/agent/release.sh rollback [dir] [--dry-run] # mặc định: release trước đó
#   scripts/agent/release.sh prune [--keep N] [--yes]   # mặc định chỉ in (dry-run), keep 2
#
# build in "READY <dir>" khi thành công và ghi <dir>/.agent-smoke-ok (commit, schema hash).
# promote chỉ nhận dir có marker; smoke fail trên 3001 → tự rollback về dir cũ.
# Log đầy đủ: .agent-logs/<run-id>/. Không bao giờ in giá trị env/secret.
#
# Override (để test, không đụng service thật):
#   RELEASE_SERVICE   tên unit (my-task.service)
#   RELEASE_DROPIN    file drop-in giữ NEXT_DIST_DIR (~/.config/systemd/user/my-task.service.d/release.conf)
#   RELEASE_SYSTEMCTL lệnh systemctl ("systemctl --user"; ví dụ "echo systemctl" để giả)
#   RELEASE_ORIGIN    origin production cho wait/smoke (http://127.0.0.1:3001)
#   RELEASE_SMOKE     lệnh smoke, nhận origin làm tham số (node scripts/smoke-storefront.mjs)
#   RELEASE_WAIT      số giây chờ server lên (120)
#   RELEASE_HISTORY   file lịch sử promote/rollback (.agent-logs/release-history)

source "$(dirname "$0")/lib.sh"
cd "$AGENT_ROOT" || exit 1

SERVICE="${RELEASE_SERVICE:-my-task.service}"
DROPIN="${RELEASE_DROPIN:-$HOME/.config/systemd/user/$SERVICE.d/release.conf}"
read -r -a SYSTEMCTL <<<"${RELEASE_SYSTEMCTL:-systemctl --user}"
ORIGIN="${RELEASE_ORIGIN:-http://127.0.0.1:3001}"
read -r -a SMOKE <<<"${RELEASE_SMOKE:-node scripts/smoke-storefront.mjs}"
WAIT="${RELEASE_WAIT:-120}"
MARKER=".agent-smoke-ok"
HISTORY="${RELEASE_HISTORY:-$AGENT_ROOT/.agent-logs/release-history}"
SMOKE_FILTER='HTTP|failures|Error|error|không'

usage() { sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

# ---------- helpers ----------

# NEXT_DIST_DIR cấu hình trong drop-in.
conf_dist() { sed -nE 's/^Environment="?NEXT_DIST_DIR=([^" ]+)"?.*/\1/p' "$DROPIN" 2>/dev/null | tail -n1; }
# Release trước đó (comment do script ghi vào drop-in).
conf_prev() { sed -nE 's/^# agent-release previous=([^ ]*).*/\1/p' "$DROPIN" 2>/dev/null | tail -n1; }

# NEXT_DIST_DIR của tiến trình đang chạy (phát hiện drop-in đổi mà chưa restart).
running_dist() {
  local pid
  pid=$("${SYSTEMCTL[@]}" show "$SERVICE" -p MainPID --value 2>/dev/null)
  [[ "$pid" =~ ^[1-9][0-9]*$ && -r /proc/$pid/environ ]] || return 0
  tr '\0' '\n' </proc/"$pid"/environ | sed -n 's/^NEXT_DIST_DIR=//p'
}

# Nạp Environment= của service (trừ NEXT_DIST_DIR) vào env hiện tại, không in giá trị.
# Cần thiết: NEXT_PUBLIC_* được inline lúc build và service override .env.
load_service_env() {
  local raw kv n=0
  local -a kvs=()
  raw=$(systemctl --user show "$SERVICE" -p Environment --value 2>/dev/null) || true
  [[ -n "$raw" ]] || die "không đọc được Environment của $SERVICE"
  [[ "$raw" == *\"* ]] && say "⚠ Environment có giá trị chứa khoảng trắng/quote — kiểm tra lại parse"
  # Tách theo khoảng trắng nhưng không glob (giá trị chứa * ? [ không bị mở rộng).
  read -r -a kvs <<<"$raw"
  for kv in "${kvs[@]}"; do
    [[ "$kv" == *=* ]] || continue
    [[ "${kv%%=*}" == NEXT_DIST_DIR ]] && continue
    export "${kv%%=*}=${kv#*=}"; n=$((n + 1))
  done
  say "· env: $n biến từ $SERVICE (+ .env do Next nạp)"
}

schema_hash() {
  { cat prisma/schema.prisma; find prisma/migrations -type f 2>/dev/null | LC_ALL=C sort | xargs -r cat; } \
    | sha256sum | cut -c1-16
}

smoke_summary() { local l; l=$(grep -E 'checks, [0-9]+ failures' "$1" | tail -n1); [[ -n "$l" ]] && say "  $l"; return 0; }

marker_get() { sed -n "s/^$2=//p" "$1/$MARKER" 2>/dev/null | head -n1; }

is_release_dir() {
  [[ "$1" =~ ^\.next-release-[A-Za-z0-9._-]+$ && -d "$1" && -f "$1/BUILD_ID" ]]
}

human_age() {
  local s=$(($(date +%s) - $1))
  if ((s < 3600)); then echo "$((s / 60))m"; elif ((s < 172800)); then echo "$((s / 3600))h"; else echo "$((s / 86400))d"; fi
}

# Có thay đổi schema giữa live và candidate không? In lý do, return 0 nếu CÓ.
schema_changed() {
  local live="$1" cand="$2" lh ch since changes
  ch=$(marker_get "$cand" schema)
  lh=$(marker_get "$live" schema)
  if [[ -n "$lh" && -n "$ch" ]]; then
    [[ "$lh" != "$ch" ]] && { say "⚠ schema hash khác: live=$lh candidate=$ch"; return 0; }
    return 1
  fi
  # Live chưa có marker: so git từ lúc build live (mtime BUILD_ID) + thay đổi chưa commit.
  since=$(stat -c %Y "$live/BUILD_ID" 2>/dev/null || echo 0)
  changes=$(git log --since="@$since" --format='%h %s' -- prisma/schema.prisma prisma/migrations 2>/dev/null)
  changes+=$(git status --porcelain -- prisma/schema.prisma prisma/migrations 2>/dev/null)
  if [[ -n "$changes" ]]; then
    say "⚠ prisma schema/migrations đổi từ khi build live ($live):"
    printf '%s\n' "$changes" | head -n 10 | sed 's/^/    /'
    return 0
  fi
  return 1
}

write_dropin() { # <dir> <previous>
  local tmp
  mkdir -p "$(dirname "$DROPIN")"
  tmp="$DROPIN.tmp.$$"
  {
    echo "[Service]"
    echo "Environment=NEXT_DIST_DIR=$1"
    echo "# agent-release previous=$2 at=$(date -u +%FT%TZ)"
  } >"$tmp" && mv "$tmp" "$DROPIN"
}

# Chuyển service sang <dir>, restart, chờ, smoke. return 0 nếu smoke OK.
switch_to() { # <dir> <previous> <stepname>
  local dir="$1" prev="$2" step="$3"
  write_dropin "$dir" "$prev"
  run_step "$step-reload" "${SYSTEMCTL[@]}" daemon-reload || return 1
  run_step "$step-restart" "${SYSTEMCTL[@]}" restart "$SERVICE" || return 1
  sleep 2
  if ! wait_http "$ORIGIN/login" "$WAIT"; then
    say "✗ $ORIGIN không lên sau ${WAIT}s"
    "${SYSTEMCTL[@]}" status "$SERVICE" --no-pager -n 15 2>&1 | strip_ansi | tail -n 15
    return 1
  fi
  AGENT_FILTER="$SMOKE_FILTER" run_step "$step-smoke" "${SMOKE[@]}" "$ORIGIN" || return 1
  smoke_summary "$AGENT_LOG_DIR/$step-smoke.log"
  echo "$(date -u +%FT%TZ) $step $dir prev=$prev" >>"$HISTORY"
}

# ---------- status ----------

cmd_status() {
  local do_smoke=0 live prev run d age size mark tag
  local -a dirs=()
  [[ "${1:-}" == --smoke ]] && do_smoke=1
  live=$(conf_dist); prev=$(conf_prev); run=$(running_dist)
  say "service: $SERVICE $("${SYSTEMCTL[@]}" is-active "$SERVICE" 2>/dev/null) since $("${SYSTEMCTL[@]}" show "$SERVICE" -p ActiveEnterTimestamp --value 2>/dev/null)"
  say "live:    ${live:-<chưa đặt>}  (drop-in: ${DROPIN/#$HOME/\~})"
  [[ -n "$run" && "$run" != "$live" ]] && say "⚠ tiến trình đang chạy dùng $run ≠ drop-in (chưa restart?)"
  say "previous: ${prev:-<không rõ>}"
  say "HEAD:    $(git rev-parse --short HEAD) $( [[ -n "$(git status --porcelain)" ]] && echo '(dirty)') schema=$(schema_hash)"
  say "dirs:"
  mapfile -t dirs < <(ls -1td .next-release-* .next-e2e-* 2>/dev/null)
  for d in "${dirs[@]}"; do
    [[ -d "$d" ]] || continue
    age=$(human_age "$(stat -c %Y "$d")")
    size=$(du -sh "$d" 2>/dev/null | cut -f1)
    tag=""
    [[ "$d" == "$live" ]] && tag+=" [LIVE]"
    [[ "$d" == "$prev" ]] && tag+=" [PREVIOUS]"
    if [[ -f "$d/$MARKER" ]]; then
      mark="smoke-ok@$(marker_get "$d" commit | cut -c1-8)$( [[ $(marker_get "$d" dirty) == 1 ]] && echo +dirty) schema=$(marker_get "$d" schema)"
    elif [[ -f "$d/BUILD_ID" ]]; then mark="no-marker"; else mark="incomplete"; fi
    printf '  %-48s %6s %5s  %s%s\n' "$d" "$size" "$age" "$mark" "$tag"
  done
  if ((do_smoke)); then
    AGENT_FILTER="$SMOKE_FILTER" run_step prod-smoke "${SMOKE[@]}" "$ORIGIN" &&
      smoke_summary "$AGENT_LOG_DIR/prod-smoke.log"
  fi
}

# ---------- build ----------

SERVER_PID=""
stop_server() {
  [[ -n "$SERVER_PID" ]] || return 0
  kill -TERM -- "-$SERVER_PID" 2>/dev/null || kill -TERM "$SERVER_PID" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$SERVER_PID" 2>/dev/null || break; sleep 1; done
  kill -KILL -- "-$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
}

cmd_build() {
  local label="" dir ts port live log rc
  while (($#)); do
    case "$1" in
      --label) label="${2:-}"; shift 2 ;;
      *) die "tham số lạ: $1" ;;
    esac
  done
  label=$(printf '%s' "$label" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9-' '-' | sed -E 's/-+/-/g; s/^-|-$//g')
  ts=$(date -u +%Y%m%d-%H%M%S)
  dir=".next-release-${label:+$label-}$ts"
  live=$(conf_dist)
  [[ "$dir" == "$live" ]] && die "trùng dir live: $dir"
  [[ -e "$dir" ]] && die "đã tồn tại: $dir (không ghi đè)"

  say "build $dir  (HEAD $(git rev-parse --short HEAD)$( [[ -n "$(git status --porcelain)" ]] && echo ', working tree DIRTY — WIP chưa commit sẽ vào build'))"
  load_service_env
  export NEXT_DIST_DIR="$dir"

  log="$AGENT_LOG_DIR/build.log"
  # next build tự ghi "<distDir>/types/**" vào tsconfig.json — khôi phục nguyên trạng.
  cp -p tsconfig.json "$AGENT_LOG_DIR/tsconfig.json.orig"
  AGENT_FILTER='$^' run_step build pnpm build; rc=$?
  cmp -s tsconfig.json "$AGENT_LOG_DIR/tsconfig.json.orig" ||
    { cp -p "$AGENT_LOG_DIR/tsconfig.json.orig" tsconfig.json && say "· khôi phục tsconfig.json (next build đã sửa)"; }
  if ((rc != 0)); then
    # Lọc lỗi gọn; không có dòng khớp thì in tail.
    if grep -qE 'rror|⨯|Failed|Invalid environment' "$log"; then
      grep -E -A3 'rror|⨯|Failed to compile|Invalid environment' "$log" | head -n 40
    else
      tail -n 25 "$log"
    fi
    say "FAILED build — dir dở dang còn lại: $dir (xóa thủ công nếu không cần)"
    return 1
  fi
  grep -E '✓ (Compiled|Generating static)|Finished TypeScript' "$log" | sed 's/^ */  /'

  port=$(free_port 3110)
  trap 'stop_server' EXIT
  trap 'stop_server; exit 130' INT TERM
  setsid node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$port" \
    >"$AGENT_LOG_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  local start=$SECONDS
  if ! wait_http "http://127.0.0.1:$port/login" "$WAIT"; then
    say "✗ server tạm cổng $port không lên sau ${WAIT}s — log: ${AGENT_LOG_DIR#"$AGENT_ROOT"/}/server.log"
    strip_ansi <"$AGENT_LOG_DIR/server.log" | tail -n 20
    stop_server
    say "FAILED $dir"
    return 1
  fi
  say "✓ start :$port ($((SECONDS - start))s)"
  if ! AGENT_FILTER="$SMOKE_FILTER" run_step smoke "${SMOKE[@]}" "http://127.0.0.1:$port"; then
    stop_server
    grep -E 'rror|⨯' "$AGENT_LOG_DIR/server.log" | strip_ansi | head -n 10
    say "FAILED $dir"
    return 1
  fi
  smoke_summary "$AGENT_LOG_DIR/smoke.log"
  stop_server
  trap - EXIT INT TERM

  {
    echo "commit=$(git rev-parse HEAD)"
    echo "dirty=$( [[ -n "$(git status --porcelain)" ]] && echo 1 || echo 0)"
    echo "schema=$(schema_hash)"
    echo "built_at=$(date -u +%FT%TZ)"
    echo "smoke=$(grep -E 'checks, [0-9]+ failures' "$AGENT_LOG_DIR/smoke.log" | tail -n1)"
  } >"$dir/$MARKER"
  say "READY $dir"
  say "next: scripts/agent/release.sh promote $dir   (cần user đồng ý)"
}

# ---------- promote / rollback ----------

do_switch() { # <mode promote|rollback> <dir> <schema_ok> <dry>
  local mode="$1" dir="${2%/}" schema_ok="$3" dry="$4" live
  dir="${dir#./}"
  live=$(conf_dist)
  is_release_dir "$dir" || die "không phải release dir hợp lệ (cần .next-release-* có BUILD_ID): $dir"
  [[ "$dir" == "$live" ]] && die "$dir đang là live"
  if [[ "$mode" == promote ]]; then
    [[ -f "$dir/$MARKER" ]] || die "$dir chưa có $MARKER — chạy build (smoke) trước"
  else
    [[ -f "$dir/$MARKER" ]] || say "⚠ $dir không có $MARKER (release cũ) — vẫn rollback"
  fi
  if [[ -n "$live" && -d "$live" ]] && schema_changed "$live" "$dir"; then
    if [[ "$mode" == promote && "$schema_ok" != 1 ]]; then
      say "✗ dừng: chạy 'pnpm exec prisma migrate deploy' (DB production) trước, rồi promote lại với --schema-ok"
      return 2
    fi
    say "⚠ tiếp tục dù schema khác (--schema-ok / rollback): đảm bảo DB tương thích"
  fi

  say "$mode: $live → $dir"
  if ((dry)); then
    say "[dry-run] ghi ${DROPIN/#$HOME/\~}:"
    printf '    %s\n' "[Service]" "Environment=NEXT_DIST_DIR=$dir" "# agent-release previous=$live"
    say "[dry-run] ${SYSTEMCTL[*]} daemon-reload && ${SYSTEMCTL[*]} restart $SERVICE"
    say "[dry-run] wait $ORIGIN/login, ${SMOKE[*]} $ORIGIN"
    return 0
  fi

  if switch_to "$dir" "$live" "$mode"; then
    say "OK live=$dir  previous=$live"
    say "rollback: scripts/agent/release.sh rollback"
    return 0
  fi
  if [[ "$mode" == promote && -n "$live" ]]; then
    say "↩ smoke/khởi động fail — tự rollback về $live"
    if switch_to "$live" "$dir" "auto-rollback"; then
      say "ROLLED BACK live=$live (bản $dir lỗi, xem log ${AGENT_LOG_DIR#"$AGENT_ROOT"/})"
    else
      say "✗✗ ROLLBACK CŨNG FAIL — service có thể đang down. Kiểm tra: systemctl --user status $SERVICE"
    fi
  else
    say "✗ $mode fail. live hiện là $dir; quay lại: scripts/agent/release.sh rollback $live"
  fi
  return 1
}

cmd_promote() {
  local dir="" schema_ok=0 dry=0
  while (($#)); do
    case "$1" in
      --schema-ok) schema_ok=1 ;;
      --dry-run) dry=1 ;;
      -*) die "tham số lạ: $1" ;;
      *) dir="$1" ;;
    esac
    shift
  done
  [[ -n "$dir" ]] || die "cần <dir>"
  do_switch promote "$dir" "$schema_ok" "$dry"
}

cmd_rollback() {
  local dir="" dry=0
  while (($#)); do
    case "$1" in
      --dry-run) dry=1 ;;
      -*) die "tham số lạ: $1" ;;
      *) dir="$1" ;;
    esac
    shift
  done
  dir="${dir:-$(conf_prev)}"
  [[ -n "$dir" ]] || die "không biết release trước đó — truyền dir: rollback <dir> (xem status)"
  do_switch rollback "$dir" 1 "$dry"
}

# ---------- prune ----------

cmd_prune() {
  local keep=2 yes=0 live prev d kept=0 total=0 sz
  local -a del=() dirs=()
  while (($#)); do
    case "$1" in
      --keep) keep="${2:-}"; shift ;;
      --yes) yes=1 ;;
      --dry-run) yes=0 ;;
      *) die "tham số lạ: $1" ;;
    esac
    shift
  done
  [[ "$keep" =~ ^[0-9]+$ ]] || die "--keep cần số"
  live=$(conf_dist); prev=$(conf_prev)
  [[ -n "$live" ]] || die "không xác định được live dir — từ chối prune"
  mapfile -t dirs < <(ls -1td .next-release-* 2>/dev/null)
  for d in "${dirs[@]}"; do
    [[ -d "$d" ]] || continue
    [[ "$d" == "$live" || "$d" == "$prev" ]] && continue
    if ((kept < keep)); then kept=$((kept + 1)); continue; fi
    del+=("$d")
  done
  for d in .next-e2e-*; do [[ -d "$d" ]] && del+=("$d"); done
  say "giữ: live=$live previous=${prev:-?} + $kept release mới nhất"
  if ((${#del[@]} == 0)); then say "không có gì để xóa"; return 0; fi
  for d in "${del[@]}"; do
    sz=$(du -sm "$d" | cut -f1); total=$((total + sz))
    say "  $( ((yes)) && echo 'xóa' || echo 'sẽ xóa') $d (${sz}M)"
    ((yes)) && rm -rf -- "$d"
  done
  say "$( ((yes)) && echo 'đã giải phóng' || echo 'dry-run, sẽ giải phóng') ~${total}M$( ((yes)) || echo ' — thêm --yes để xóa')"
}

# ---------- main ----------

case "${1:-}" in
  status) shift; cmd_status "$@" ;;
  build) shift; cmd_build "$@" ;;
  promote) shift; cmd_promote "$@" ;;
  rollback) shift; cmd_rollback "$@" ;;
  prune) shift; cmd_prune "$@" ;;
  -h | --help | help) usage 0 ;;
  *) usage 1 ;;
esac
