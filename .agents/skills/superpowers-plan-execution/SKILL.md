---
name: superpowers-plan-execution
description: >
  Execute tasks and implementation plans defined in docs/superpowers/plans/.
  Use when the user mentions "skill superpowers", plan execution, or continuing
  an existing implementation plan.
---

# Superpowers Plan Execution

Guidance for executing structured implementation plans from `docs/superpowers/plans/`.

## Core Principles

1. **Dependency Order**: Implement tasks in the exact sequence specified by the plan document.
2. **Test-First (TDD)**: Begin each task with a failing test that captures the requirement.
3. **Strict Scope**: Implement only the files and logic required for the active task.
4. **Focused Quality Gate**: Run targeted tests (`pnpm vitest run <path>`) and type checks before committing.
5. **Atomic Commits**: Create an independent Conventional Commit for each task immediately upon passing checks (`feat(...)`, `fix(...)`, `test(...)`). Do not bundle multiple tasks together ("không commit lẫn lộn cả cục").
6. **Push at Finish**: When the entire plan or assigned mission is completed and verified, push all commits to the active tracking branch.

## Workflow Steps

1. Locate the latest active plan in `docs/superpowers/plans/`.
2. Inspect the task checklist and identify the next uncompleted task.
3. Write/update unit or integration test(s) verifying the expected behavior.
4. Implement the minimal required code to satisfy the test.
5. Run the focused test suite and verify it passes cleanly.
6. Create an isolated commit (e.g., `feat(catalog): add price range filter`).
7. Update task checkboxes in the plan document if applicable.
8. Repeat until the goal is met, then push to remote: `git push origin <branch>`.
