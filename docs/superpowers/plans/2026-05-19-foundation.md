# Foundation Implementation Plan

> **SUPERSEDED (2026-09-04)** — plan này thuộc spec personal task app đã bị thay thế bởi POS bán hàng. Không thực thi.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the auth + database foundation for the personal task app. After this plan, a user can sign in with GitHub, land on a session-gated app shell, and see empty Today / Inbox / Settings routes. No task domain yet — that ships in Plan 2.

**Architecture:** Add MongoDB (Mongoose ODM with an HMR-safe singleton) and Auth.js v5 GitHub OAuth (with `@auth/mongodb-adapter`) on top of the existing Next 16 base. Use a Next middleware to gate `/(app)/*` and `/api/*` except auth + webhook whitelist. UI shell is a Server Component sidebar + topbar inside an `(app)` route group; signin lives in an `(auth)` group.

**Tech Stack:** Next 16 App Router, TypeScript strict, MongoDB 7, Mongoose 8, Auth.js v5 (next-auth@5), `@auth/mongodb-adapter`, official `mongodb` driver, Vitest + `mongodb-memory-server` for tests, existing shadcn/ui + Tailwind 4.

**Spec reference:** `docs/superpowers/specs/2026-05-19-personal-task-app-design.md` sections 2, 4, 8, 12.

---

## File Structure

**Create:**
- `.env.example` — required env vars template
- `src/server/db/mongoose.ts` — HMR-safe Mongoose singleton
- `src/server/db/models/User.ts` — Mongoose User model
- `src/server/db/mongo-client.ts` — `mongodb` driver promise (for Auth.js adapter)
- `src/server/auth/auth.ts` — Auth.js v5 config (`auth`, `handlers`, `signIn`, `signOut`)
- `src/server/auth/adapter.ts` — wires `@auth/mongodb-adapter`
- `src/middleware.ts` — auth gate
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js route handler
- `src/app/(auth)/signin/page.tsx` — sign-in page
- `src/app/(app)/layout.tsx` — session-gated app shell (sidebar + topbar)
- `src/app/(app)/today/page.tsx` — Today placeholder
- `src/app/(app)/inbox/page.tsx` — Inbox placeholder
- `src/app/(app)/settings/page.tsx` — Settings placeholder
- `src/components/shared/sidebar.tsx` — sidebar nav
- `src/components/shared/topbar.tsx` — topbar with user menu / signout
- `src/providers/session-provider.tsx` — wraps Auth.js `<SessionProvider>`
- `src/lib/session.ts` — `requireSession()` helper for RSC + actions
- `tests/server/db/mongoose.test.ts`
- `tests/server/db/models/user.test.ts`
- `tests/server/auth/auth.test.ts`
- `tests/middleware.test.ts`
- `tests/config/env.test.ts`

**Modify:**
- `package.json` — add dependencies
- `src/config/env.ts` — extend Zod schema for Mongo + NextAuth + GitHub
- `src/providers/index.tsx` — compose `SessionProvider` outermost
- `src/app/layout.tsx` — no change expected (Providers already wired)
- `vitest.setup.ts` — add `mongodb-memory-server` global setup
- `.gitignore` — ensure `.env*.local`, `uploads/` covered (verify only)

**Test:** Each new server module ships with a Vitest unit/integration spec under `tests/`. E2E signin via Playwright is deferred to Plan 2 because GitHub OAuth e2e requires a credentials test provider; this plan covers it with unit tests.

---

## Task 1: Add dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

Run:
```bash
pnpm add mongoose@^8 next-auth@beta @auth/mongodb-adapter mongodb
```
Expected: lockfile updated; no peer warnings beyond Next 16.

- [ ] **Step 2: Install dev deps**

Run:
```bash
pnpm add -D mongodb-memory-server@^10
```
Expected: lockfile updated.

- [ ] **Step 3: Sanity check installs**

Run:
```bash
pnpm typecheck
```
Expected: PASS (no new files yet; baseline still green).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add mongoose, next-auth v5, mongodb adapter, mongodb-memory-server"
```

---

## Task 2: Create `.env.example`

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write `.env.example`**

```bash
# .env.example — copy to .env.local and fill in

# Core
NODE_ENV=development
NEXT_PUBLIC_APP_NAME="Personal Tasks"
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Auth (NextAuth v5)
# Generate: openssl rand -base64 32
AUTH_SECRET=
AUTH_URL=http://localhost:3000

# GitHub OAuth (https://github.com/settings/developers)
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/personal-tasks

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example for foundation env vars"
```

---

## Task 3: Extend env schema with failing test first

**Files:**
- Modify: `src/config/env.ts`
- Create: `tests/config/env.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/config/env.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("env schema", () => {
  const ORIG = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIG };
  });

  it("loads valid env", async () => {
    process.env.AUTH_SECRET = "x".repeat(32);
    process.env.AUTH_GITHUB_ID = "id";
    process.env.AUTH_GITHUB_SECRET = "secret";
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    const { env } = await import("@/config/env");
    expect(env.MONGODB_URI).toBe("mongodb://localhost:27017/test");
    expect(env.AUTH_GITHUB_ID).toBe("id");
  });

  it("rejects missing MONGODB_URI", async () => {
    process.env.AUTH_SECRET = "x".repeat(32);
    process.env.AUTH_GITHUB_ID = "id";
    process.env.AUTH_GITHUB_SECRET = "secret";
    delete process.env.MONGODB_URI;
    await expect(import("@/config/env")).rejects.toThrow(
      /Invalid environment variables/,
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test tests/config/env.test.ts
```
Expected: FAIL (`MONGODB_URI` not in schema).

- [ ] **Step 3: Update `src/config/env.ts`**

Replace file contents with:

```ts
import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Personal Tasks"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
  AUTH_GITHUB_ID: z.string().min(1),
  AUTH_GITHUB_SECRET: z.string().min(1),

  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb")),

  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test tests/config/env.test.ts
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts tests/config/env.test.ts
git commit -m "feat(config): extend env schema with auth + mongodb vars"
```

---

## Task 4: Mongoose singleton (HMR-safe)

**Files:**
- Create: `src/server/db/mongoose.ts`
- Create: `tests/server/db/mongoose.test.ts`
- Modify: `vitest.setup.ts`

- [ ] **Step 1: Update `vitest.setup.ts` for memory mongo**

```ts
import "@testing-library/jest-dom/vitest";
```

Already exists. Add nothing here yet — `mongodb-memory-server` is started per-test-file to avoid global cost.

- [ ] **Step 2: Write failing test**

Create `tests/server/db/mongoose.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";

vi.mock("@/config/env", () => ({ env: { MONGODB_URI: "" } }));

describe("mongoose singleton", () => {
  let mem: MongoMemoryServer;

  beforeAll(async () => {
    mem = await MongoMemoryServer.create();
    (await import("@/config/env")).env.MONGODB_URI = mem.getUri();
  });

  afterAll(async () => {
    const { disconnect } = await import("@/server/db/mongoose");
    await disconnect();
    await mem.stop();
  });

  it("connects once and reuses the connection", async () => {
    const { connectMongoose } = await import("@/server/db/mongoose");
    const a = await connectMongoose();
    const b = await connectMongoose();
    expect(a).toBe(b);
    expect(a.readyState).toBe(1);
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
pnpm test tests/server/db/mongoose.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 4: Create singleton**

Create `src/server/db/mongoose.ts`:

```ts
import mongoose, { type Mongoose } from "mongoose";

import { env } from "@/config/env";

declare global {
  var __mongoose__: { conn: Mongoose | null; promise: Promise<Mongoose> | null } | undefined;
}

const cache =
  globalThis.__mongoose__ ?? (globalThis.__mongoose__ = { conn: null, promise: null });

export async function connectMongoose(): Promise<Mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnect(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test tests/server/db/mongoose.test.ts
```
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/mongoose.ts tests/server/db/mongoose.test.ts
git commit -m "feat(db): add HMR-safe mongoose singleton"
```

---

## Task 5: MongoDB driver client for Auth.js adapter

**Files:**
- Create: `src/server/db/mongo-client.ts`

- [ ] **Step 1: Create client**

```ts
import { MongoClient } from "mongodb";

import { env } from "@/config/env";

declare global {
  var __mongoClient__: Promise<MongoClient> | undefined;
}

function build(): Promise<MongoClient> {
  return new MongoClient(env.MONGODB_URI).connect();
}

export const mongoClientPromise: Promise<MongoClient> =
  globalThis.__mongoClient__ ?? (globalThis.__mongoClient__ = build());
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/server/db/mongo-client.ts
git commit -m "feat(db): add mongodb driver client for auth adapter"
```

---

## Task 6: User Mongoose model

**Files:**
- Create: `src/server/db/models/User.ts`
- Create: `tests/server/db/models/user.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";

vi.mock("@/config/env", () => ({ env: { MONGODB_URI: "" } }));

describe("User model", () => {
  let mem: MongoMemoryServer;

  beforeAll(async () => {
    mem = await MongoMemoryServer.create();
    (await import("@/config/env")).env.MONGODB_URI = mem.getUri();
    await (await import("@/server/db/mongoose")).connectMongoose();
  });

  afterAll(async () => {
    await (await import("@/server/db/mongoose")).disconnect();
    await mem.stop();
  });

  beforeEach(async () => {
    const { UserModel } = await import("@/server/db/models/User");
    await UserModel.deleteMany({});
  });

  it("creates user with defaults", async () => {
    const { UserModel } = await import("@/server/db/models/User");
    const u = await UserModel.create({ email: "a@b.com", name: "A" });
    expect(u.email).toBe("a@b.com");
    expect(u.settings.theme).toBe("system");
    expect(u.timezone).toBe("Asia/Ho_Chi_Minh");
    expect(u.pushSubscriptions).toEqual([]);
  });

  it("requires email", async () => {
    const { UserModel } = await import("@/server/db/models/User");
    await expect(UserModel.create({ name: "X" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test tests/server/db/models/user.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Create model**

`src/server/db/models/User.ts`:

```ts
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const PushSubscriptionSchema = new Schema(
  {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    ua: String,
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const SettingsSchema = new Schema(
  {
    reminderChannels: {
      webpush: { type: Boolean, default: true },
      telegram: { type: Boolean, default: false },
      badge: { type: Boolean, default: true },
    },
    defaultRemindBeforeMin: { type: Number, default: 30 },
    weekStartsOn: { type: Number, enum: [0, 1], default: 1 },
    theme: { type: String, enum: ["system", "light", "dark"], default: "system" },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: String,
    image: String,
    githubId: String,
    telegramChatId: String,
    telegramLinkToken: String,
    pushSubscriptions: { type: [PushSubscriptionSchema], default: [] },
    timezone: { type: String, default: "Asia/Ho_Chi_Minh" },
    settings: { type: SettingsSchema, default: () => ({}) },
  },
  { timestamps: true, collection: "users" },
);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: unknown };

export const UserModel: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", UserSchema);
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test tests/server/db/models/user.test.ts
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/models/User.ts tests/server/db/models/user.test.ts
git commit -m "feat(db): add User mongoose model with settings + push subs"
```

---

## Task 7: Auth.js v5 adapter wiring

**Files:**
- Create: `src/server/auth/adapter.ts`

- [ ] **Step 1: Write adapter wrapper**

```ts
import { MongoDBAdapter } from "@auth/mongodb-adapter";

import { mongoClientPromise } from "@/server/db/mongo-client";

export const authAdapter = MongoDBAdapter(mongoClientPromise, {
  databaseName: undefined, // pulled from connection string
  collections: {
    Users: "users",
    Accounts: "accounts",
    Sessions: "sessions",
    VerificationTokens: "verification_tokens",
  },
});
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/server/auth/adapter.ts
git commit -m "feat(auth): add mongodb adapter for next-auth"
```

---

## Task 8: NextAuth v5 config with failing test

**Files:**
- Create: `src/server/auth/auth.ts`
- Create: `tests/server/auth/auth.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";

describe("auth config", () => {
  it("exports auth handlers and helpers", async () => {
    const mod = await import("@/server/auth/auth");
    expect(typeof mod.auth).toBe("function");
    expect(typeof mod.signIn).toBe("function");
    expect(typeof mod.signOut).toBe("function");
    expect(mod.handlers.GET).toBeTypeOf("function");
    expect(mod.handlers.POST).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test tests/server/auth/auth.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Create auth config**

`src/server/auth/auth.ts`:

```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import { env } from "@/config/env";
import { authAdapter } from "@/server/auth/adapter";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: authAdapter,
  session: { strategy: "database" },
  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    session: ({ session, user }) => {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test tests/server/auth/auth.test.ts
```
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/auth.ts tests/server/auth/auth.test.ts
git commit -m "feat(auth): wire next-auth v5 github provider with mongo adapter"
```

---

## Task 9: Auth.js route handler

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create route**

```ts
export { GET, POST } from "@/server/auth/auth";
```

Wait — `handlers` is the export. Use:

```ts
import { handlers } from "@/server/auth/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/[...nextauth]/route.ts
git commit -m "feat(auth): expose next-auth route handlers"
```

---

## Task 10: `requireSession()` helper

**Files:**
- Create: `src/lib/session.ts`

- [ ] **Step 1: Create helper**

```ts
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  return session;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/session.ts
git commit -m "feat(auth): add requireSession helper for rsc + actions"
```

---

## Task 11: Middleware auth gate with failing test

**Files:**
- Create: `src/middleware.ts`
- Create: `tests/middleware.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/auth/auth", () => ({
  auth: vi.fn(),
}));

import { middleware } from "@/middleware";
import { auth as mockedAuth } from "@/server/auth/auth";

function req(pathname: string) {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

describe("middleware", () => {
  it("redirects unauthenticated user from /today to /signin", async () => {
    (mockedAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await middleware(req("/today"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/signin");
  });

  it("allows authenticated user through", async () => {
    (mockedAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "u1" },
    });
    const res = await middleware(req("/today"));
    expect(res.status).toBe(200);
  });

  it("lets /api/auth/* through unauthenticated", async () => {
    (mockedAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await middleware(req("/api/auth/signin"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test tests/middleware.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Create middleware**

`src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/server/auth/auth";

const PUBLIC_PREFIXES = [
  "/signin",
  "/api/auth",
  "/api/telegram/webhook",
  "/api/push/vapid",
  "/_next",
  "/favicon",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const session = await auth();
  if (!session?.user?.id) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test tests/middleware.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts tests/middleware.test.ts
git commit -m "feat(auth): add middleware gate for app + api routes"
```

---

## Task 12: SessionProvider in client tree

**Files:**
- Create: `src/providers/session-provider.tsx`
- Modify: `src/providers/index.tsx`

- [ ] **Step 1: Create wrapper**

`src/providers/session-provider.tsx`:

```tsx
"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { PropsWithChildren } from "react";

export function SessionProvider({ children }: PropsWithChildren) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

- [ ] **Step 2: Compose in `providers/index.tsx`**

Replace contents of `src/providers/index.tsx` with:

```tsx
"use client";

import { PropsWithChildren } from "react";

import { QueryProvider } from "./query-provider";
import { SessionProvider } from "./session-provider";
import { ThemeProvider } from "./theme-provider";

export function Providers({ children }: PropsWithChildren) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <QueryProvider>{children}</QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/providers/session-provider.tsx src/providers/index.tsx
git commit -m "feat(providers): wire next-auth session provider"
```

---

## Task 13: Signin page

**Files:**
- Create: `src/app/(auth)/signin/page.tsx`

- [ ] **Step 1: Create page**

```tsx
import { redirect } from "next/navigation";

import { auth, signIn } from "@/server/auth/auth";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  const { from } = await searchParams;
  if (session?.user?.id) redirect(from ?? "/today");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <header>
          <h1 className="text-xl font-semibold">Personal Tasks</h1>
          <p className="text-sm text-zinc-500">Sign in to continue.</p>
        </header>
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: from ?? "/today" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
          >
            Continue with GitHub
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/signin/page.tsx
git commit -m "feat(auth): add signin page with github action"
```

---

## Task 14: App shell — sidebar + topbar + (app) layout

**Files:**
- Create: `src/components/shared/sidebar.tsx`
- Create: `src/components/shared/topbar.tsx`
- Create: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Sidebar**

`src/components/shared/sidebar.tsx`:

```tsx
import Link from "next/link";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/inbox", label: "Inbox" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:block">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Navigate
      </h2>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Topbar**

`src/components/shared/topbar.tsx`:

```tsx
import { signOut } from "@/server/auth/auth";

export function Topbar({ user }: { user: { name?: string | null; email?: string | null } }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-sm font-medium">Personal Tasks</div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
        className="flex items-center gap-3"
      >
        <span className="text-sm text-zinc-500">{user.name ?? user.email}</span>
        <button
          type="submit"
          className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
```

- [ ] **Step 3: App layout**

`src/app/(app)/layout.tsx`:

```tsx
import { Sidebar } from "@/components/shared/sidebar";
import { Topbar } from "@/components/shared/topbar";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={session.user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/sidebar.tsx src/components/shared/topbar.tsx src/app/\(app\)/layout.tsx
git commit -m "feat(app): add session-gated shell with sidebar + topbar"
```

---

## Task 15: Placeholder Today / Inbox / Settings pages

**Files:**
- Create: `src/app/(app)/today/page.tsx`
- Create: `src/app/(app)/inbox/page.tsx`
- Create: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Today**

```tsx
export const metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Today</h1>
      <p className="text-sm text-zinc-500">No tasks yet. Wired up in Plan 2.</p>
    </section>
  );
}
```

- [ ] **Step 2: Inbox**

```tsx
export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <p className="text-sm text-zinc-500">Unsorted tasks land here.</p>
    </section>
  );
}
```

- [ ] **Step 3: Settings**

```tsx
import { requireSession } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
        <dt className="text-zinc-500">Name</dt>
        <dd>{session.user.name ?? "—"}</dd>
        <dt className="text-zinc-500">Email</dt>
        <dd>{session.user.email ?? "—"}</dd>
      </dl>
    </section>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/today/page.tsx src/app/\(app\)/inbox/page.tsx src/app/\(app\)/settings/page.tsx
git commit -m "feat(app): add today/inbox/settings placeholder routes"
```

---

## Task 16: Redirect `/` → `/today`

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace landing with redirect**

Inspect existing `src/app/page.tsx` first (`cat src/app/page.tsx`), then replace contents with:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/today");
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(app): redirect root to /today"
```

---

## Task 17: Full quality gate

- [ ] **Step 1: Lint**

```bash
pnpm lint
```
Expected: 0 errors.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Unit tests**

```bash
pnpm test
```
Expected: all suites green (env, mongoose, user model, auth config, middleware).

- [ ] **Step 4: Manual smoke (operator)**

Run locally:

1. Create GitHub OAuth app at https://github.com/settings/developers, callback `http://localhost:3000/api/auth/callback/github`.
2. Fill `.env.local` from `.env.example`. Run `openssl rand -base64 32` for `AUTH_SECRET`.
3. Start MongoDB: `docker run -d --name mongo -p 27017:27017 mongo:7` (or local mongod).
4. `pnpm dev` → visit `http://localhost:3000` → expect redirect `/today` → redirect `/signin`.
5. Click "Continue with GitHub" → OAuth → land on `/today` placeholder.
6. Check Mongo: `mongosh personal-tasks --eval 'db.users.findOne()'` → user doc present.
7. Click "Sign out" → back to `/signin`.

Document any failure as a follow-up; do not silently fix.

- [ ] **Step 5: Final commit if any tweaks**

```bash
git status
# if clean — done
```

---

## Self-Review Notes

Run inline before handing off:

1. **Spec coverage:** Foundation covers spec §2 (User model partial), §4 (folder layout for `server/db`, `server/auth`, `middleware.ts`), §8 (auth gate, env validation), §12 (env vars subset). Remaining sections covered by later plans.
2. **Placeholder scan:** None — every step has concrete code or exact command.
3. **Type consistency:** `connectMongoose` / `disconnect` used identically across tasks. `UserModel` named the same in Task 6 + test. `auth/handlers/signIn/signOut` exported from `auth.ts` consumed in route, middleware, layout, signin, topbar — matching shape.
4. **Open follow-ups for Plan 2:** Playwright e2e signin (needs OAuth test mode), TaskModel + Project/Section models, today/inbox queries, sidebar count badges.
