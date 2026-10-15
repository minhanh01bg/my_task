#!/usr/bin/env bash
# Dùng chung cho scripts/agent/*: chạy lệnh dài, lưu log đầy đủ ra file và chỉ in
# phần tóm tắt/lỗi để agent không phải đọc hàng nghìn dòng log.
#
#   source "$(dirname "$0")/lib.sh"
#   run_step "typecheck" pnpm typecheck            # ✓/✗ + thời gian, tail lỗi khi fail
#   AGENT_FILTER='error|FAIL' run_step ...          # regex lọc dòng lỗi (tùy chọn)
#
# Log: .agent-logs/<run-id>/<step>.log (đã gitignore). Exit code của run_step = exit
# code của lệnh. AGENT_VERBOSE=1 in toàn bộ log ra stdout.

set -o pipefail

AGENT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENT_RUN_ID="${AGENT_RUN_ID:-$(date -u +%Y%m%d-%H%M%S)-$$}"
AGENT_LOG_DIR="${AGENT_LOG_DIR:-$AGENT_ROOT/.agent-logs/$AGENT_RUN_ID}"
AGENT_TAIL="${AGENT_TAIL:-40}"
mkdir -p "$AGENT_LOG_DIR"

# Xóa mã màu ANSI để log/grep gọn.
strip_ansi() { sed -E 's/\x1b\[[0-9;?]*[a-zA-Z]//g'; }

say() { printf '%s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

# run_step <name> <cmd...>
run_step() {
  local name="$1"; shift
  local log="$AGENT_LOG_DIR/${name//[^a-zA-Z0-9_.-]/_}.log"
  local start=$SECONDS status
  if [[ "${AGENT_VERBOSE:-0}" == 1 ]]; then
    "$@" 2>&1 | strip_ansi | tee "$log"; status=$?
  else
    "$@" >"$log" 2>&1; status=$?
    strip_ansi <"$log" >"$log.tmp" && mv "$log.tmp" "$log"
  fi
  local dur=$((SECONDS - start))
  if ((status == 0)); then
    say "✓ $name (${dur}s)"
  else
    say "✗ $name (${dur}s, exit $status) — log: ${log#"$AGENT_ROOT"/}"
    if [[ -n "${AGENT_FILTER:-}" ]]; then
      grep -E -- "$AGENT_FILTER" "$log" | head -n "$AGENT_TAIL"
    else
      tail -n "$AGENT_TAIL" "$log"
    fi
  fi
  return $status
}

# Cổng còn trống đầu tiên từ $1 (mặc định 3110).
free_port() {
  local p="${1:-3110}"
  while (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; do p=$((p + 1)); done
  echo "$p"
}

# Đợi URL trả HTTP < 500, tối đa $2 giây (mặc định 120).
wait_http() {
  local url="$1" limit="${2:-120}" i
  for ((i = 0; i < limit; i++)); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" || true)
    [[ "$code" =~ ^[234] ]] && return 0
    sleep 1
  done
  return 1
}
