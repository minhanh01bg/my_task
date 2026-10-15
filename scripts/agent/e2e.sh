#!/usr/bin/env bash
# Chạy Playwright E2E cô lập, chỉ in tóm tắt + lỗi.
#
#   scripts/agent/e2e.sh [spec...] [-g <grep>] [--prod <release-dir>] [--keep] [-- <playwright args>]
#   scripts/agent/e2e.sh --clean-stale [--yes]
#
# Mỗi lần chạy: DB riêng prisma/agent-e2e/<id>.db (prisma db push), cổng trống từ 3120,
# distDir riêng .next-e2e-<id> (dev: build dev riêng; --prod: cp -a từ <release-dir>,
# không bao giờ chạy fixture E2E trên artifact deploy), test-results riêng trong log dir.
# Gọi qua `pnpm test:e2e` (không dùng `pnpm exec playwright`).
#
#   --prod <dir>   chạy `next start` trên bản sao của build <dir> (vd .next-release-...)
#   --keep         giữ DB + build copy kể cả khi pass (fail luôn giữ)
#   --clean-stale  liệt kê DB fixture cũ trong prisma/ và thư mục .next-e2e-* (dry-run);
#                  thêm --yes để xóa. Không bao giờ đụng dev.db/test.db/DB trong .env* hay
#                  systemd my-task.service, file sửa < 2 giờ, hoặc file đang mở.
#   -h             trợ giúp
#
# Output: "N passed, M failed, K skipped (Ts)", mỗi failure: file:line › title + lỗi
# + đường dẫn trace/screenshot; dòng cuối "E2E PASS" / "E2E FAIL".
# Log đầy đủ: .agent-logs/<run-id>/ (playwright.log, report.json, test-results/).

source "$(dirname "$0")/lib.sh"
cd "$AGENT_ROOT" || exit 1

usage() { sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

specs=() pw_args=() grep_pat="" prod_src="" keep=0 clean_stale=0 yes=0
while (($#)); do
  case "$1" in
    -h|--help) usage ;;
    -g|--grep) grep_pat="${2:?thiếu pattern cho -g}"; shift 2 ;;
    --prod) prod_src="${2:?thiếu thư mục cho --prod}"; shift 2 ;;
    --keep) keep=1; shift ;;
    --clean-stale) clean_stale=1; shift ;;
    --yes) yes=1; shift ;;
    --) shift; pw_args+=("$@"); break ;;
    -*) pw_args+=("$1"); shift ;;
    *) specs+=("$1"); shift ;;
  esac
done

# ---------------------------------------------------------------- clean-stale
if ((clean_stale)); then
  protected=()
  for f in .env*; do
    [[ -f "$f" ]] || continue
    while IFS= read -r u; do protected+=("$(basename "${u%%\?*}")"); done < <(
      grep -hoE '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=["'\'']?file:[^"'\'' ]+' "$f" | sed -E 's/.*file://')
  done
  while IFS= read -r u; do protected+=("$(basename "${u%%\?*}")"); done < <(
    systemctl --user cat my-task.service 2>/dev/null | grep -oE 'DATABASE_URL=["'\'']?file:[^"'\'' ]+' | sed -E 's/.*file://')
  svc_dist=$(systemctl --user cat my-task.service 2>/dev/null | grep -oE 'NEXT_DIST_DIR=[^ "]+' | tail -1 | cut -d= -f2)
  is_protected() {
    local b="$1" p
    b="${b%-wal}"; b="${b%-shm}"; b="${b%-journal}"
    [[ "$b" == dev.db || "$b" == test.db ]] && return 0
    for p in "${protected[@]}"; do [[ "$b" == "$p" ]] && return 0; done
    return 1
  }
  cands=() skipped=0
  while IFS= read -r f; do
    if is_protected "$(basename "$f")" || [[ -n $(find "$f" -mmin -120 2>/dev/null) ]] \
      || fuser -s "$f" 2>/dev/null; then skipped=$((skipped + 1)); continue; fi
    cands+=("$f")
  done < <(find prisma -maxdepth 3 -type f \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' -o -name '*.db-journal' \) | sort)
  for d in .next-e2e-*/; do
    [[ -d "$d" ]] || continue
    d="${d%/}"
    [[ "$d" == "$svc_dist" || -n $(find "$d" -maxdepth 0 -mmin -120) ]] && { skipped=$((skipped + 1)); continue; }
    lsof +D "$d" >/dev/null 2>&1 && { skipped=$((skipped + 1)); continue; }
    cands+=("$d")
  done
  if ((${#cands[@]} == 0)); then say "Không có gì để dọn (bỏ qua $skipped mục được bảo vệ/mới/đang dùng)."; exit 0; fi
  size=$(du -sch "${cands[@]}" 2>/dev/null | tail -1 | cut -f1)
  say "${#cands[@]} mục cũ ($size), bỏ qua $skipped mục được bảo vệ/mới/đang dùng:"
  # Gộp .db/-wal/-shm thành một dòng; liệt kê đầy đủ ở $AGENT_LOG_DIR/stale.txt.
  printf '%s\n' "${cands[@]}" >"$AGENT_LOG_DIR/stale.txt"
  printf '%s\n' "${cands[@]}" | sed -E 's/-(wal|shm|journal)$//' | sort -u | head -n 40 | sed 's/^/  /'
  n=$(printf '%s\n' "${cands[@]}" | sed -E 's/-(wal|shm|journal)$//' | sort -u | wc -l)
  ((n > 40)) && say "  … +$((n - 40)) mục — danh sách đủ: ${AGENT_LOG_DIR#"$AGENT_ROOT"/}/stale.txt"
  if ((yes)); then rm -rf -- "${cands[@]}" && say "✓ đã xóa ${#cands[@]} mục"; else say "(dry-run — thêm --yes để xóa)"; fi
  exit 0
fi

# ---------------------------------------------------------------- run
id="$AGENT_RUN_ID"
db_dir="$AGENT_ROOT/prisma/agent-e2e"
db="$db_dir/$id.db"
dist=".next-e2e-$id"
out="$AGENT_LOG_DIR/test-results"
json="$AGENT_LOG_DIR/report.json"
mkdir -p "$db_dir"
[[ -f "$db_dir/.gitignore" ]] || echo '*' >"$db_dir/.gitignore"

if [[ -n "$prod_src" ]]; then
  prod_src="${prod_src%/}"
  [[ -f "$prod_src/BUILD_ID" ]] || die "$prod_src không phải build production (thiếu BUILD_ID)"
fi

port=$(free_port 3120)
export DATABASE_URL="file:$db"
export PLAYWRIGHT_PORT="$port"
export PLAYWRIGHT_CANONICAL_ORIGIN="http://127.0.0.1:$port"
export PLAYWRIGHT_JSON_OUTPUT_NAME="$json"
# Dev cũng dùng distDir riêng: không ghi vào .next, không tranh lock với `next dev` khác.
export NEXT_DIST_DIR="$dist"
[[ -n "$prod_src" ]] && export PLAYWRIGHT_PRODUCTION_DIR="$dist"

# `next dev` với distDir tùy chỉnh tự chèn đường dẫn vào tsconfig.json/next-env.d.ts —
# chụp lại để khôi phục sau khi chạy.
snap="$AGENT_LOG_DIR/snap"; mkdir -p "$snap"
cp -p tsconfig.json "$snap/" 2>/dev/null; cp -p next-env.d.ts "$snap/" 2>/dev/null
restore_snap() {
  local f
  for f in tsconfig.json next-env.d.ts; do
    [[ -f "$snap/$f" ]] && grep -q -- "$dist" "$f" 2>/dev/null && cp -p "$snap/$f" "$f"
  done
}
trap restore_snap EXIT

say "e2e $id · port $port · ${prod_src:+prod copy of $prod_src · }${specs[*]:-all specs}${grep_pat:+ · -g \"$grep_pat\"}"

avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
((avail < 1000)) && say "! RAM khả dụng ${avail}MB, load $(cut -d' ' -f1 /proc/loadavg) — webServer (timeout 60s) có thể không kịp khởi động"
AGENT_FILTER='[Ee]rror|failed|✗' run_step prisma-db-push pnpm exec prisma db push --skip-generate \
  || { say "DB: $db"; say "E2E FAIL"; exit 1; }
if [[ -n "$prod_src" ]]; then
  run_step copy-build cp -a "$prod_src" "$dist" || { say "E2E FAIL"; exit 1; }
fi

args=(--reporter=line,json "--output=$out")
[[ -n "$grep_pat" ]] && args+=(-g "$grep_pat")
args+=("${pw_args[@]}")
start=$SECONDS
pnpm test:e2e "${args[@]}" -- "${specs[@]}" >"$AGENT_LOG_DIR/playwright.log" 2>&1
status=$?
strip_ansi <"$AGENT_LOG_DIR/playwright.log" >"$AGENT_LOG_DIR/pw.tmp" && mv "$AGENT_LOG_DIR/pw.tmp" "$AGENT_LOG_DIR/playwright.log"
restore_snap

rel() { printf '%s' "${1#"$AGENT_ROOT"/}"; }
if [[ -s "$json" ]]; then
  node - "$json" "$AGENT_ROOT" <<'NODE'
const fs = require("fs");
const [file, root] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(file, "utf8"));
const rel = (p) => (p || "").replace(root + "/", "");
const strip = (s) => (s || "").replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
const s = r.stats || {};
const fails = [];
const walk = (suite, titles) => {
  const t = suite.title && !suite.file?.endsWith(suite.title) ? [...titles, suite.title] : titles;
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      if (test.status !== "unexpected" && test.status !== "flaky") continue;
      const res = test.results || [];
      const last = res[res.length - 1] || {};
      fails.push({ spec, test, last, titles: [...t, spec.title] });
    }
  }
  for (const c of suite.suites || []) walk(c, t);
};
for (const su of r.suites || []) walk(su, []);
const flaky = fails.filter((f) => f.test.status === "flaky").length;
console.log(
  `${s.expected ?? 0} passed, ${s.unexpected ?? 0} failed, ${s.skipped ?? 0} skipped` +
    (flaky ? `, ${flaky} flaky` : "") + ` (${Math.round((s.duration ?? 0) / 1000)}s)`,
);
for (const f of fails) {
  const loc = f.last.error?.location;
  const where = loc ? `${rel(loc.file)}:${loc.line}` : `${f.spec.file}:${f.spec.line}`;
  console.log(`\n✗ ${where} › ${f.titles.join(" › ")}${f.test.status === "flaky" ? " (flaky)" : ""}`);
  const msg = strip(f.last.error?.message || f.last.errors?.[0]?.message || "(no error message)");
  for (const l of msg.split("\n").filter((l) => l.trim()).slice(0, 8)) console.log("    " + l);
  for (const a of f.last.attachments || [])
    if (a.path && /trace|screenshot|video|error-context/.test(a.name)) console.log(`    ${a.name}: ${rel(a.path)}`);
}
for (const e of r.errors || []) {
  const m = strip(e.message || "");
  console.log("\n✗ (global) " + m.split("\n").filter(Boolean).slice(0, 8).join("\n    "));
  if (/config\.webServer/.test(m))
    console.log("    hint: server không lên trong 60s — máy quá tải/cold compile? xem [WebServer] trong log; thử lại khi rảnh");
}
NODE
else
  say "Không có report JSON (Playwright không chạy được) — trích log:"
  grep -E -i 'error|failed|timed out|EADDRINUSE|Missing|Invalid' "$AGENT_LOG_DIR/playwright.log" | head -n 20 \
    || tail -n 20 "$AGENT_LOG_DIR/playwright.log"
fi
say "($((SECONDS - start))s wall) log: $(rel "$AGENT_LOG_DIR")/playwright.log"

cleanup() { rm -f -- "$db" "$db-wal" "$db-shm" "$db-journal"; rm -rf -- "$dist"; }
if ((status == 0)); then
  if ((keep)); then say "kept: DB $(rel "$db") · build $dist"; else cleanup; fi
  say "E2E PASS"
else
  say "kept: DB $(rel "$db")$([[ -d "$dist" ]] && printf ' · build %s' "$dist")"
  say "dọn: rm -rf $(rel "$db")* $dist"
  say "E2E FAIL"
fi
exit $status
