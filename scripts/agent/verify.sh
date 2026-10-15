#!/usr/bin/env bash
# verify.sh — lint + typecheck + vitest (tương đương `pnpm check`), output gọn cho agent.
#
# Usage: scripts/agent/verify.sh [options]
#   (không cờ)          lint toàn repo, tsc, toàn bộ vitest; dừng ở bước fail đầu tiên
#   --fast              chỉ file đổi so với HEAD (kể cả untracked): eslint file đổi,
#                       vitest --changed HEAD; tsc vẫn chạy toàn bộ
#   --only lint|types|test   chỉ chạy một bước (lặp lại cờ để chọn nhiều bước)
#   --test <path> [-t <name>] chỉ chạy vitest cho file/thư mục (lặp --test được),
#                       -t lọc theo tên test (truyền thẳng cho vitest)
#   --continue          chạy hết mọi bước dù có bước fail
#   --format            thêm bước prettier --check trên file đổi
#   -h, --help          in hướng dẫn này
#
# Output: mỗi bước một dòng ✓/✗; khi fail in lỗi rút gọn (tối đa $VERIFY_MAX dòng/bước,
# mặc định 30), dòng cuối luôn là `VERIFY PASS` hoặc `VERIFY FAIL: <steps>`.
# Log đầy đủ + JSON thô: .agent-logs/<run-id>/. AGENT_VERBOSE=1 in toàn bộ log.
# Exit code: 0 khi pass, 1 khi fail, 2 khi sai cú pháp.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$AGENT_ROOT" || exit 2

usage() { sed -n '2,/^$/{s/^# \{0,1\}//;p}' "${BASH_SOURCE[0]}"; }

FAST=0 CONTINUE=0 FORMAT=0
ONLY=() TEST_PATHS=() TEST_NAME=""
while (($#)); do
  case "$1" in
    --fast) FAST=1 ;;
    --continue) CONTINUE=1 ;;
    --format) FORMAT=1 ;;
    --only)
      [[ "${2:-}" =~ ^(lint|types|test)$ ]] || { usage; exit 2; }
      ONLY+=("$2"); shift ;;
    --test)
      [[ -n "${2:-}" ]] || { usage; exit 2; }
      TEST_PATHS+=("$2"); shift ;;
    -t)
      [[ -n "${2:-}" ]] || { usage; exit 2; }
      TEST_NAME="$2"; shift ;;
    -h | --help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n\n' "$1"; usage; exit 2 ;;
  esac
  shift
done

# --test / -t ngụ ý chỉ chạy bước test (trừ khi --only chỉ định khác).
if ((${#TEST_PATHS[@]})) || [[ -n "$TEST_NAME" ]]; then
  ((${#ONLY[@]})) || ONLY=(test)
fi
want() { ((${#ONLY[@]} == 0)) || [[ " ${ONLY[*]} " == *" $1 "* ]]; }

MAX="${VERIFY_MAX:-30}"
export AGENT_TAIL="$MAX" AGENT_FILTER='^» '

# File đổi so với HEAD + untracked, còn tồn tại.
changed_files() {
  { git diff --name-only HEAD; git ls-files --others --exclude-standard; } |
    sort -u | while IFS= read -r f; do [[ -f "$f" ]] && printf '%s\n' "$f"; done
}

# ---- các bước: output thô vào log, dòng tóm tắt có tiền tố "» " (run_step lọc theo nó)

step_format() {
  local files=()
  mapfile -t files < <(changed_files | grep -E '\.(jsx?|tsx?|mjs|cjs|json|md|css|ya?ml)$')
  ((${#files[@]})) || { echo "no changed files"; return 0; }
  pnpm exec prettier --check --ignore-unknown "${files[@]}" 2>&1 | tee /dev/stderr |
    sed -nE 's/^\[warn\] (.+)$/» \1/p' | grep -v 'Code style issues' | head -n "$MAX"
  return "${PIPESTATUS[0]}"
}

step_lint() {
  local json="$AGENT_LOG_DIR/eslint.json" files=(.) status
  if ((FAST)); then
    mapfile -t files < <(changed_files | grep -E '\.(jsx?|tsx?|mjs|cjs)$')
    ((${#files[@]})) || { echo "no changed lint files"; return 0; }
  fi
  pnpm exec eslint --no-warn-ignored --format json --output-file "$json" "${files[@]}"
  status=$?
  [[ -s "$json" ]] || return "$status"
  node - "$json" "$MAX" <<'JS'
const [file, max] = process.argv.slice(2);
const results = JSON.parse(require("fs").readFileSync(file, "utf8"));
const cwd = process.cwd() + "/";
let errors = 0, warnings = 0;
const lines = [];
for (const r of results) {
  warnings += r.warningCount;
  for (const m of r.messages) {
    if (m.severity !== 2) continue;
    errors++;
    lines.push(`» ${r.filePath.replace(cwd, "")}:${m.line ?? 0}:${m.column ?? 0} ${m.message.split("\n")[0]} [${m.ruleId ?? "fatal"}]`);
  }
}
console.log(lines.slice(0, +max).join("\n"));
if (lines.length > +max) console.log(`» … +${lines.length - max} more`);
console.log(`» eslint: ${errors} error(s), ${warnings} warning(s) in ${results.length} file(s)`);
JS
  return "$status"
}

step_types() {
  pnpm exec tsc --noEmit --pretty false 2>&1 | tee /dev/stderr |
    grep -E '^[^ ].*: error TS[0-9]+' | awk '!seen[$0]++' |
    awk -v max="$MAX" '{ n++; if (n <= max) print "» " $0 } END { if (n > max) print "» … +" n - max " more"; if (n) print "» tsc: " n " error(s)" }'
  return "${PIPESTATUS[0]}"
}

step_test() {
  local json="$AGENT_LOG_DIR/vitest.json" status
  local args=(run --reporter=dot --reporter=json "--outputFile.json=$json")
  ((FAST && ${#TEST_PATHS[@]} == 0)) && args+=(--changed HEAD --passWithNoTests)
  [[ -n "$TEST_NAME" ]] && args+=(-t "$TEST_NAME")
  rm -f "$json"
  pnpm exec vitest "${args[@]}" "${TEST_PATHS[@]}"
  status=$?
  if [[ -s "$json" ]]; then
    local strict=0
    ((FAST && ${#TEST_PATHS[@]} == 0)) || strict=1
    node - "$json" "$MAX" "$strict" <<'JS' || ((status)) || status=1
const [file, max, strict] = process.argv.slice(2);
const r = JSON.parse(require("fs").readFileSync(file, "utf8"));
const cwd = process.cwd() + "/";
const clean = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const lines = [];
for (const f of r.testResults ?? []) {
  const rel = f.name.replace(cwd, "");
  const failed = (f.assertionResults ?? []).filter((a) => a.status === "failed");
  for (const a of failed) {
    const msg = clean(a.failureMessages?.[0] ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    const at = msg.find((l) => l.includes(rel)) ?? "";
    const loc = at.match(/:(\d+):\d+\)?$/)?.[1];
    lines.push(`» FAIL ${rel}${loc ? ":" + loc : ""} > ${a.fullName}`);
    for (const l of msg.slice(0, 3).filter((l) => !l.startsWith("at "))) lines.push(`»     ${l.slice(0, 200)}`);
  }
  if (!failed.length && f.status === "failed") {
    const msg = clean(f.message || "suite failed").split("\n").find(Boolean) ?? "";
    lines.push(`» FAIL ${rel} (suite): ${msg.slice(0, 200)}`);
  }
}
console.log(lines.slice(0, +max).join("\n"));
if (lines.length > +max) console.log(`» … +${lines.length - max} more`);
console.log(`» vitest: ${r.numFailedTests} failed, ${r.numPassedTests} passed, ${(r.testResults ?? []).filter((f) => f.status === "failed").length}/${(r.testResults ?? []).length} file(s) failed`);
// --test/-t lọc hết mọi test (chỉ skipped) thì coi là fail, tránh PASS giả.
if (strict === "1" && r.numPassedTests + r.numFailedTests === 0 && (r.testResults ?? []).length) {
  console.log("» no test ran (all skipped / -t matched nothing)");
  process.exit(3);
}
JS
  fi
  return "$status"
}

# Bước fail mà không parse được lỗi cụ thể (crash, global setup, unhandled error…):
# in đuôi log thô để không mất thông tin.
fallback_tail() {
  local log="$AGENT_LOG_DIR/$1.log"
  grep -E '^» ' "$log" 2>/dev/null | grep -qvE '^» (eslint|tsc|vitest):' && return
  say "  (no parsed errors; tail of log)"
  grep -vE '^» ' "$log" | grep -v '^\s*$' | tail -n 15 | sed 's/^/  /'
}

# ---- chạy
STEPS=()
((FORMAT)) && STEPS+=(format)
want lint && STEPS+=(lint)
want types && STEPS+=(types)
want test && STEPS+=(test)

mode="full"; ((FAST)) && mode="fast"
((${#TEST_PATHS[@]})) && mode="test ${TEST_PATHS[*]}${TEST_NAME:+ -t \"$TEST_NAME\"}"
say "verify ($mode) — logs: ${AGENT_LOG_DIR#"$AGENT_ROOT"/}"

FAILED=()
for s in "${STEPS[@]}"; do
  if ! run_step "$s" "step_$s"; then
    FAILED+=("$s")
    [[ "${AGENT_VERBOSE:-0}" == 1 ]] || fallback_tail "$s"
    ((CONTINUE)) || break
  fi
done

if ((${#FAILED[@]})); then
  say "VERIFY FAIL: ${FAILED[*]}"
  exit 1
fi
say "VERIFY PASS"
