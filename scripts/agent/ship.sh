#!/usr/bin/env bash
# ship.sh — commit ONLY the given paths with a Conventional Commit, then push.
#
#   scripts/agent/ship.sh -m "<type>(<scope>): <subject>" [--body text] [--no-push] [--dry-run] -- <paths...>
#   scripts/agent/ship.sh --status      # dirty files grouped by area + ahead/behind
#
# Types: feat fix test refactor chore docs perf style build ci (scope required, "!" allowed).
# Refuses when no paths are given or when files outside <paths> are already staged
# (never sweeps someone else's work). Appends the Co-Authored-By trailer, supplies a
# git identity if none is configured, shows a compact tail when husky/lint-staged
# fails (full log in .agent-logs/), pushes the current branch (sets upstream if
# missing) unless --no-push. Output: "<sha> <subject>" and the push result.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TYPES="feat|fix|test|refactor|chore|docs|perf|style|build|ci"
TRAILER="Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

usage() { sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

msg="" body="" push=1 dry=0 status_mode=0 paths=()
while (($#)); do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -m|--message) msg="${2-}"; shift 2 || die "-m needs a value" ;;
    --body) body="${2-}"; shift 2 || die "--body needs a value" ;;
    --no-push) push=0; shift ;;
    --dry-run) dry=1; shift ;;
    --status) status_mode=1; shift ;;
    --) shift; paths=("$@"); break ;;
    *) die "unknown argument: $1 (paths go after --; see -h)" ;;
  esac
done

cd "$AGENT_ROOT" || die "cannot cd to $AGENT_ROOT"
git rev-parse --git-dir >/dev/null 2>&1 || die "not a git repository: $AGENT_ROOT"

branch="$(git symbolic-ref --quiet --short HEAD || true)"
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"

if ((status_mode)); then
  if [[ -n "$upstream" ]]; then
    timeout 15 git fetch --quiet 2>/dev/null || true  # best effort; offline is fine
    read -r behind ahead < <(git rev-list --left-right --count "$upstream...HEAD")
    say "branch ${branch:-DETACHED} → $upstream: ahead $ahead, behind $behind"
  else
    say "branch ${branch:-DETACHED}: no upstream"
  fi
  porcelain="$(git status --porcelain=v1 --untracked-files=normal)"
  [[ -z "$porcelain" ]] && { say "clean"; exit 0; }
  staged=$(grep -c '^[MADRC]' <<<"$porcelain" || true)
  say "dirty $(wc -l <<<"$porcelain" | tr -d ' ') (staged $staged)"
  # Area = first path segment; src/<x> and tests/<x> keep two segments.
  awk '{
      code = substr($0, 1, 2); p = substr($0, 4)
      sub(/.* -> /, "", p); gsub(/"/, "", p)
      n = split(p, s, "/")
      area = s[1]
      if ((s[1] == "src" || s[1] == "tests") && n > 2) area = s[1] "/" s[2]
      if (n == 1 || (n == 2 && s[2] == "")) area = "."
      gsub(/ /, "", code); if (code == "??") code = "?"
      cnt[area]++
      if (cnt[area] <= 4) list[area] = list[area] " " code ":" p
      else if (cnt[area] == 5) list[area] = list[area] " …"
    }
    END { for (a in cnt) printf "  %-26s %2d %s\n", a, cnt[a], list[a] }' <<<"$porcelain" | sort
  exit 0
fi

[[ -n "$msg" ]] || die "missing -m \"<type>(<scope>): <subject>\""
((${#paths[@]})) || die "no paths given; refusing to commit (list files after --)"
[[ "$msg" != *$'\n'* ]] || die "-m must be a single line; use --body for details"
[[ "$msg" =~ ^($TYPES)\([a-z0-9][a-z0-9._/,-]*\)!?:\ [^[:space:]].*$ ]] ||
  die "bad commit subject: '$msg' (want <type>(<scope>): <subject>, type ∈ ${TYPES//|/ })"
((${#msg} <= 100)) || die "subject longer than 100 chars (${#msg})"
[[ -n "$branch" ]] || die "detached HEAD; checkout a branch first"

# Every path must exist or be known to git (deletions are allowed).
for p in "${paths[@]}"; do
  [[ -e "$p" ]] || git ls-files --error-unmatch -- "$p" >/dev/null 2>&1 ||
    git ls-files --deleted -- "$p" | grep -q . || die "path not found: $p"
done

# Refuse if something outside our paths is already staged.
mapfile -t staged_all < <(git diff --cached --name-only)
mapfile -t staged_ours < <(git diff --cached --name-only -- "${paths[@]}")
if ((${#staged_all[@]} > ${#staged_ours[@]})); then
  foreign="$(comm -23 <(printf '%s\n' "${staged_all[@]}" | sort) <(printf '%s\n' "${staged_ours[@]}" | sort))"
  die "files outside the given paths are already staged; unstage or include them:
$(head -n 10 <<<"$foreign" | sed 's/^/  /')"
fi

full_msg="$msg"
[[ -n "$body" ]] && full_msg+=$'\n\n'"$body"
full_msg+=$'\n\n'"$TRAILER"

idargs=()
[[ -n "$(git config user.name || true)" ]] ||
  idargs=(-c user.name=minhanh01bg -c user.email=55592974+minhanh01bg@users.noreply.github.com)

if ((dry)); then
  changes="$(git status --porcelain=v1 -- "${paths[@]}")"
  [[ -n "$changes" ]] || die "nothing to commit in the given paths"
  say "[dry-run] would commit on $branch ($(wc -l <<<"$changes" | tr -d ' ') files):"
  head -n 20 <<<"$changes" | sed 's/^/  /'
  say "[dry-run] message: $msg${body:+ (+body)} (+trailer)${idargs:+ [fallback identity]}"
  if ((push)); then say "[dry-run] would push $branch → ${upstream:-origin/$branch (set upstream)}"; fi
  exit 0
fi

git add -A -- "${paths[@]}" || die "git add failed"
git diff --cached --quiet -- "${paths[@]}" && die "nothing to commit in the given paths"

msgfile="$AGENT_LOG_DIR/commit-msg.txt"
printf '%s\n' "$full_msg" >"$msgfile"
if ! out="$(AGENT_TAIL=25 run_step commit git "${idargs[@]}" commit -F "$msgfile")"; then
  printf '%s\n' "$out"
  die "commit failed (hook or git error); changes stay staged — fix and rerun"
fi
say "$(git log -1 --format='%h %s')"

((push)) || { say "push skipped (--no-push)"; exit 0; }
if [[ -n "$upstream" ]]; then
  remote="${upstream%%/*}" rbranch="${upstream#*/}"
  out="$(run_step push git push "$remote" "HEAD:$rbranch")"; rc=$?
  target="$upstream"
else
  remote="$(git config "branch.$branch.remote" || true)"; remote="${remote:-origin}"
  out="$(run_step push git push -u "$remote" "$branch")"; rc=$?
  target="$remote/$branch (upstream set)"
fi
if ((rc)); then
  printf '%s\n' "$out"
  die "push failed; commit is local"
fi
say "pushed → $target"
