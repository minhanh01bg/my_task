# Personal Task App — Design Spec

- **Date:** 2026-05-19
- **Owner:** minhanh01bg
- **Base:** `nextjs-with-agent` (Next 16 + React 19 + TS strict + Tailwind 4 + shadcn + React Query + Zod)
- **Status:** Draft, awaiting user review

## 1. Purpose & Scope

A self-hosted personal task manager (Asana-lite, single-user) to combat forgetfulness. Multi-project, sub-tasks, due dates, priority, tags, recurring tasks, attachments, and multi-channel reminders.

**In scope (MVP):**

- Project + Section + Task hierarchy with sub-tasks
- Views: List, Kanban (drag-drop), Today/Inbox dashboard
- Reminders: in-app badge, Web Push (Service Worker + VAPID), Telegram bot
- Recurring tasks (RRULE)
- Local-disk attachments
- GitHub OAuth via NextAuth (Auth.js v5)
- AI module **placeholder** (scaffold only, real provider phase 2)

**Out of scope (phase 1):**

- Multi-user / sharing
- Calendar view (revisit phase 2)
- Time tracking, comments threading beyond simple notes
- Mobile native app
- Real AI provider wiring (placeholder noop)

## 2. Tech Stack (additions to base)

- **mongoose** — MongoDB ODM
- **next-auth@5** + `@auth/mongodb-adapter` — GitHub OAuth
- **ioredis + bullmq** — job queue (replaces `node-cron`)
- **web-push** — VAPID server send
- **grammy** — Telegram bot (webhook mode)
- **formidable** + **sharp** — uploads + optional image resize
- **@dnd-kit/core** — Kanban drag-drop
- **date-fns**, **rrule** — date utils, recurring rules
- **pino** — structured logging (extend existing `lib/logger.ts`)
- **@bull-board/express** — queue admin UI (owner-gated)

No Prisma. MongoDB-only ODM keeps the install surface small.

## 3. Data Model (MongoDB)

All user-owned docs carry `userId` and are filtered by it in every query. Soft delete via `deletedAt` for `Project` and `Task`.

```ts
User {
  _id, email, name, image, githubId,
  telegramChatId?: string,
  pushSubscriptions: [{ endpoint, keys: { p256dh, auth }, ua, createdAt }],
  timezone: string,                    // IANA, default 'Asia/Ho_Chi_Minh'
  settings: {
    reminderChannels: { webpush: bool, telegram: bool, badge: bool },
    defaultRemindBeforeMin: number,    // default 30
    weekStartsOn: 0|1,                 // Sunday or Monday
    theme: 'system'|'light'|'dark'
  },
  createdAt, updatedAt
}

// NextAuth standard via mongodb-adapter
Account, Session, VerificationToken

Project {
  _id, userId, name, color, icon,
  archived: bool, deletedAt?,
  order: number,
  createdAt, updatedAt
}

Section {
  _id, projectId, name, order
}

Task {
  _id, userId, projectId, sectionId?,
  title, description (markdown),
  status: 'todo'|'doing'|'done',
  priority: 'low'|'med'|'high'|'urgent',
  dueAt?, remindAt?,
  tags: string[],                       // denormalized Tag.name; rename Tag = manual rebuild (acceptable for single-user)
  parentTaskId?: ObjectId,              // sub-task tree
  order: number,                        // ordering within (status|section)
  recurrence?: { rrule: string, nextRunAt: Date, templateOf?: ObjectId },
  attachments: [{ id, filename, path, size, mime, uploadedAt }],
  completedAt?, deletedAt?,
  createdAt, updatedAt
}

Tag {
  _id, userId, name, color
}
// unique (userId, name)

TaskComment {
  _id, taskId, userId, body (markdown), createdAt, updatedAt
}

NotificationLog {
  _id, userId, taskId, channel: 'webpush'|'telegram'|'badge',
  kind: 'due'|'overdue'|'remind'|'digest',
  dayBucket: 'YYYYMMDD',
  sentAt, status: 'ok'|'failed', error?
}
// unique (taskId, channel, kind, dayBucket) — idempotency

ActivityLog {
  _id, userId, taskId?, projectId?, action, meta, createdAt
}
// TTL 90 days

AiConversation {
  _id, userId, taskId?, title, createdAt, updatedAt
}

AiMessage {
  _id, conversationId, role: 'user'|'assistant'|'tool',
  content, toolCalls?, toolResults?, createdAt
}

AiUsage {
  _id, userId, provider, model, inputTok, outputTok, costUsd, at
}
```

### Indexes

- `Task`: `(userId, deletedAt, projectId, status, order)`, `(userId, deletedAt, dueAt)`, `(userId, parentTaskId)`, `(userId, tags)`
- `Project`: `(userId, archived, deletedAt, order)`
- `Section`: `(projectId, order)`
- `Tag`: `(userId, name)` unique
- `NotificationLog`: `(taskId, channel, kind, dayBucket)` unique; TTL 30 days
- `ActivityLog`: `createdAt` TTL 90 days

## 4. Architecture & Folder Layout

```
src/
  app/
    (auth)/signin/page.tsx
    (app)/
      layout.tsx                      # session-gated shell (sidebar + topbar)
      today/page.tsx
      inbox/page.tsx
      p/[projectId]/page.tsx          # List view
      p/[projectId]/board/page.tsx    # Kanban view
      t/[taskId]/page.tsx             # task detail (modal-route)
      settings/page.tsx
    api/
      auth/[...nextauth]/route.ts
      projects/route.ts
      projects/[id]/route.ts
      tasks/route.ts
      tasks/[id]/route.ts
      tasks/[id]/comments/route.ts
      tasks/[id]/attachments/route.ts
      tasks/reorder/route.ts
      tags/route.ts
      uploads/[...path]/route.ts      # auth-gated stream
      push/subscribe/route.ts
      push/vapid/route.ts
      notifications/stream/route.ts   # SSE for in-app badge
      telegram/webhook/route.ts
      ai/chat/route.ts                # SSE stream (placeholder)
      ai/suggest/route.ts             # one-shot (placeholder)
      health/route.ts                 # exists
    global-error.tsx, loading.tsx, not-found.tsx

  features/                           # domain-grouped UI + hooks + actions + schemas
    projects/{components,hooks,actions,schemas}
    tasks/{components,hooks,actions,schemas}
    today/{components,hooks}
    kanban/{components,hooks}
    reminders/{components,hooks}
    auth/{components,hooks}
    ai/{components,hooks,actions,schemas}

  server/                             # server-only modules
    db/
      mongoose.ts                     # HMR-safe singleton
      models/{User,Project,Section,Task,Tag,TaskComment,
              NotificationLog,ActivityLog,
              AiConversation,AiMessage,AiUsage}.ts
    auth/
      auth.ts                         # Auth.js v5 config
      adapter.ts
    queue/
      redis.ts                        # ioredis singleton
      queues.ts                       # reminders, notifications, recurring, digest, ai-jobs
      workers/{reminder,notification,recurring,digest,ai}.worker.ts
      schedulers/recurring.scheduler.ts
    services/
      task.service.ts
      project.service.ts
      notification.service.ts
      attachment.service.ts
    telegram/
      bot.ts                          # grammy
      handlers.ts                     # /start, /today, /done, /list
    webpush/
      vapid.ts, send.ts
    ai/                               # PLACEHOLDER (phase 2)
      provider.ts                     # AIProvider interface
      providers/{anthropic,openai,noop}.ts
      tools/task-tools.ts
      agents/{task-assistant,planner}.agent.ts
      prompts/system.md
      memory/index.ts
      index.ts

  components/{ui,shared}/              # existing
  config/{env.ts,site.ts}              # env extended
  lib/{http-client.ts,query-keys.ts,logger.ts,utils.ts}
  providers/                           # RQ, theme, session
  types/
  middleware.ts                        # auth gate

  instrumentation.ts                   # boot DB, Redis, BullMQ workers, Telegram webhook

uploads/                               # gitignored, mounted volume on VPS
public/sw.js                           # Web Push service worker

docker/
  Dockerfile                           # multi-stage, Next standalone
  docker-compose.yml                   # app + mongo + redis + caddy
```

### Boundaries

- **Client never imports `server/*`.** ESLint rule + TS path enforcement.
- **Mutations** flow through Server Actions in `features/*/actions` → Zod validate → `services/*` → models.
- **Queries** in RSC pages call `services/*` directly; in client components use React Query against `/api/*`.
- **Auth**: `middleware.ts` blocks `/(app)/*` and `/api/*` without a session; whitelists `/api/auth/*`, `/api/telegram/webhook`, `/api/push/vapid`.

## 5. Data Flow

### Read (Today dashboard)

```
RSC /today
  → task.service.listToday({userId})
  → Mongoose: { userId, deletedAt: null, status: { $ne: 'done' },
                $or: [{ dueAt: { $lte: endOfDay } }, { dueAt: null, ... }] }
  → render
Client hydrate → RQ key ['tasks','today'].
```

### Write (create task)

```
RHF + Zod (client) → Server Action createTask(input)
  → Zod parse (server, source of truth)
  → task.service.create:
      1. insert Task
      2. enqueue reminders if dueAt/remindAt (jobId = reminder:{taskId}:{kind})
      3. if recurrence: scheduler.upsertNextRun
      4. fire-and-forget ActivityLog
  → revalidatePath('/today', `/p/${projectId}`)
  → return { ok, task }
Client: RQ optimistic + invalidate.
```

### Update (mark done / change due)

```
PATCH /api/tasks/[id] (or Server Action)
  → Zod partial
  → service.update:
      - status='done': set completedAt; if recurrence → spawn next occurrence (new Task)
      - dueAt change: remove old jobId, enqueue new
  → revalidate.
```

### Kanban reorder

```
@dnd-kit onDragEnd → optimistic client → POST /api/tasks/reorder
  → bulkWrite { _id, status, order }
  → invalidate ['tasks', projectId].
```

### Attachment upload

```
FormData → POST /api/tasks/[id]/attachments
  → auth: session.userId === task.userId
  → formidable stream → write uploads/{userId}/{taskId}/{uuid}-{safeName}
  → sharp resize if image > 2000px (optional)
  → push to Task.attachments
Download: GET /api/uploads/[...path]
  → parse path → re-check session.userId matches first segment
  → stream file with Content-Disposition.
```

## 6. Reminder Pipeline

### Queues

```
reminders        — delayed; one job per (taskId, kind) with jobId for cancel
notifications    — fan-out per channel
recurring        — repeatable daily 00:05 UTC, materialize occurrences
digest           — repeatable per user at 8AM local timezone
ai-jobs          — placeholder
```

### Flow

```
Task create/update with dueAt:
  reminders.add('due', {taskId}, { delay: dueAt - now,
                                   jobId: `reminder:${taskId}:due` })
  reminders.add('remind', {taskId}, { delay: remindAt - now,
                                       jobId: `reminder:${taskId}:remind` }) // if remindAt

reminders worker:
  - reload task; bail if deleted/done OR dueAt/remindAt drifted (stale check)
  - for each enabled channel in user.settings.reminderChannels:
      notifications.add(channel, {taskId, userId, kind})

notifications worker:
  badge:     redis HINCRBY badge:{userId} {kind} 1 → client SSE /api/notifications/stream
  webpush:   web-push.send to each subscription; remove on 410/404
  telegram:  bot.sendMessage(user.telegramChatId, format(task, kind))
  All: NotificationLog upsert; duplicate-key → silent skip.

recurring scheduler:
  - find Task.recurrence.nextRunAt <= today + 7d
  - spawn occurrences (clone with new dueAt); update nextRunAt = rrule.after(now)

digest worker:
  - 8AM local: list due-today + overdue
  - one Telegram message + one Web Push summary.
```

### Stale & idempotency

- Re-fetch task in worker; bail on done/deleted/drift.
- `jobId` deterministic per kind → mutation cancels then re-enqueues.
- `NotificationLog` unique `(taskId, channel, kind, dayBucket)` prevents double-send.

### Telegram link

1. Settings page → POST `/api/telegram/link` → generate token, save `User.telegramLinkToken`.
2. Show deep link `https://t.me/{bot}?start={token}`.
3. Bot `/start {token}` → match → set `telegramChatId`, clear token.
4. Commands: `/today`, `/list`, `/done {shortId}`.

### Web Push

- `public/sw.js` registered on shell; subscribe with VAPID public.
- `POST /api/push/subscribe` stores subscription in `user.pushSubscriptions[]`.
- 410/404 from web-push → splice dead subscription.

## 7. AI Module (Placeholder)

Scaffold-only in phase 1. Real provider + tool calling in phase 2.

### Interface (provider-agnostic)

```ts
interface AIProvider {
  chat(input: {
    messages: AiMessage[];
    tools?: ToolSpec[];
    stream?: boolean;
  }): AsyncIterable<Chunk> | Promise<Result>;
}
```

### Use cases (phase 2)

- Break big task → sub-tasks.
- Suggest due / priority from title.
- Daily plan: read inbox + due → suggest "what to do today".
- Project status summary.
- Natural-language create: "remind me tomorrow 9am Acme meeting" → parse → task.

### Env

```
AI_PROVIDER=noop|anthropic|openai
ANTHROPIC_API_KEY?
OPENAI_API_KEY?
AI_DEFAULT_MODEL?
```

Phase 1 ships with `noop` provider returning canned suggestions and empty streams so UI can be wired without external calls.

## 8. Security

- Middleware auth gate on all `/(app)/*` and `/api/*` except whitelist.
- Every Mongo query filters `userId`. Services accept `session.userId` only.
- Zod validation at every server boundary (route handlers, Server Actions, env).
- Telegram webhook: secret token header check.
- Web Push: VAPID private stays server-side.
- Attachments:
  - path constructed server-side from `userId/taskId/uuid`; reject `..`, absolute paths, symlinks.
  - MIME whitelist + size cap `UPLOAD_MAX_MB` (default 20).
  - Served via auth-gated stream route, never public static.
- Rate limit (phase 2): Redis token bucket middleware on `/api/*`.
- Extend `next.config.ts` security headers with strict `Content-Security-Policy`.
- `.env.example` lists every required key. No secret committed.
- Sentry enabled on server + workers.

## 9. Testing

- **Vitest unit**: `server/services/*` against `mongodb-memory-server`; Zod schema round-trip; reminder stale-job logic; AI noop provider.
- **Vitest integration**: route handlers + Server Actions with MSW + memory mongo.
- **Playwright e2e**: signin (mock OAuth via test mode), create project → task → done, Kanban drag-drop, Today dashboard surfaces overdue.
- `pnpm check` (lint + typecheck + test) is the merge gate. CI fails under 70% coverage (tune later).

## 10. Deploy (VPS + Docker)

```
docker-compose.yml
  app:    Next standalone (multi-stage Dockerfile), port 3000
  mongo:  mongo:7, named volume
  redis:  redis:7-alpine, named volume
  caddy:  HTTPS via Let's Encrypt, reverse proxy → app
```

- `next.config.ts`: add `output: 'standalone'`.
- Workers run in-process via `instrumentation.ts`. Tracked as a single Approach 1 deployment. (Splitting to a dedicated `worker` service is a one-line compose addition if load grows.)
- Volume `./uploads:/app/uploads` for attachments.
- Host cron `mongodump` daily → `/backups/{date}.gz`, 14-day retention.
- `/api/health` already exists; Caddy upstream check.
- GitHub Actions: build image → push GHCR → SSH `docker compose pull && up -d`.
- `.env.production` lives on VPS only.

## 11. Observability

- Sentry: server, client, workers.
- Pino structured logs with request-id middleware.
- `@bull-board/express` mounted at `/admin/queues`, owner-only auth check.

## 12. Env Vars (`config/env.ts`)

```
# core
NEXTAUTH_URL, NEXTAUTH_SECRET
GITHUB_ID, GITHUB_SECRET

# data
MONGODB_URI
REDIS_URL

# push
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

# telegram
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_BOT_USERNAME

# uploads
UPLOAD_DIR=./uploads
UPLOAD_MAX_MB=20

# ai (placeholder)
AI_PROVIDER=noop
ANTHROPIC_API_KEY?
OPENAI_API_KEY?
AI_DEFAULT_MODEL?

# observability (existing in base)
SENTRY_DSN?
```

All loaded and Zod-parsed in `src/config/env.ts`; app refuses to boot on invalid env.

## 13. Phased Delivery

**Phase 1 — MVP (covers this spec):**

1. Mongo + Mongoose models, NextAuth GitHub.
2. Project + Task CRUD, List view, Today dashboard, Inbox.
3. Sub-tasks, tags, priorities.
4. Kanban view with drag-drop.
5. Recurring tasks (RRULE).
6. Local attachments.
7. Reminder pipeline (BullMQ) — badge + Web Push + Telegram.
8. AI module scaffolded with noop provider.
9. Docker compose + Caddy + CI deploy.
10. Vitest + Playwright suites + Sentry.

**Phase 2:**

- Calendar view.
- Real AI provider wiring + tools (split-task, NL-create, daily-plan).
- Rate limiting + CSP tightening.
- Optional worker service split.

## 14. Open Questions

- Confirm timezone default (`Asia/Ho_Chi_Minh`)?
- Mobile PWA install + offline read-only — phase 1 nice-to-have or defer?
- Backup destination (local VPS only, or push to S3-compatible)?
