# AGENTS.md

Base guardrails for this Next.js template.

## Always-on rules

- Prefer Server Components; add `"use client"` only when necessary.
- Keep route handlers typed and validate payloads.
- Never commit secrets; keep `.env.example` updated.
- Run quality checks before merge.
- **Granular Commits**: Commit incrementally as soon as an individual feature, component, or subtask is completed and passes focused checks (`feat(...)`, `fix(...)`, `test(...)`, `docs(...)`). Never bundle multiple unrelated features into one mega-commit ("không commit lẫn lộn cả cục").
- **Push on Task Completion**: When the entire assigned task or session goal is completed and verified, push all commits to the current working branch.
- **Superpowers Plan Execution**: When executing plans in `docs/superpowers/plans/`, strictly follow task dependency order, start each task with a test, implement only scoped changes, and verify before moving to the next task.

## Skill map

### Local project skills

- Feature implementation flow: `$nextjs-feature-implementation`
- API schema and contracts: `$api-contract-zod`
- Test workflow: `$testing-playwright-vitest`
- Performance tuning: `$performance-checklist`
- Release quality gate: `$release-ci-checklist`
- Superpowers plan execution: `$superpowers-plan-execution`

### External skills (Vercel)

- React and Next.js quality patterns: `$vercel-react-best-practices`
- Composition architecture patterns: `$vercel-composition-patterns`
