---
name: plan-task
description: Plan and execute a non-trivial feature or multi-file fix in this repo (new page/flow, schema change, several components, anything needing more than one commit). Use when the user asks to build/add/redesign something bigger than a one-file fix, or says "plan", "lên kế hoạch". Writes docs/superpowers/plans/YYYY-MM-DD-<slug>.md, then runs a test-first task loop with verify.sh and ship.sh.
---

# /plan-task — test-first, dependency-ordered plan + execution

Skip for one-file fixes; just do them with verify + ship.

## 1. Write the plan

1. Read `AGENTS.md` invariants and the code you will touch. If a design spec exists in
   `docs/superpowers/specs/`, link it; otherwise cite the user request + date.
2. Copy `.claude/skills/plan-task/template.md` to
   `docs/superpowers/plans/$(date +%F)-<kebab-slug>.md` and fill it in. House style:
   - Vietnamese prose (code identifiers/commands in English), short and concrete.
   - Header: Goal / Architecture / Tech Stack / Spec, then Global Constraints.
   - Tasks ordered by dependency (lib/schema → server → UI → E2E/release), each with
     `**Files:**` and checkbox steps RED → GREEN → verify → commit `type(scope): …`.
   - One task = one scoped commit. Last task = full verify, E2E, push.
3. Show the user a 3-5 line summary of the tasks; proceed unless they asked to review first.

## 2. Execute task by task

For each task, in order:

1. RED: write the failing test; `scripts/agent/verify.sh --test <file>` must fail for
   the expected reason (not a typo/import error).
2. GREEN: minimal implementation honoring AGENTS.md invariants.
3. `scripts/agent/verify.sh --fast` → `VERIFY PASS`.
4. `scripts/agent/ship.sh --no-push -m "<type>(<scope>): <subject>" -- <task files>`
   (include the plan file in the first commit or a `docs(plan)` commit).
5. Tick the task's checkboxes in the plan file.

Finish: full `scripts/agent/verify.sh`, relevant `scripts/agent/e2e.sh` specs
(production-sensitive changes: `scripts/agent/release.sh build` + `e2e.sh --prod <dir>`), fill "Execution status"
with results + shas, ship the plan update, and push (no `--no-push`). Never restart
the live service or deploy without asking.

If a task's scope turns out wrong, edit the plan first (note why), then continue.
