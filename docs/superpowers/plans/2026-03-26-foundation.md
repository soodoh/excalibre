# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Excalibre monorepo with all dev tooling, a working TanStack Start app with auth, base database schema, app shell layout, and Docker deployment.

**Architecture:** Turborepo monorepo with `apps/web` (TanStack Start) and `apps/docs` (Starlight). The web app mirrors allstarr's patterns — file-based routing, server functions, Drizzle ORM, better-auth, shadcn/ui. Single-process Docker container.

**Tech Stack:** TanStack Start, TanStack Router, React Query v5, Drizzle ORM, SQLite (bun:sqlite), better-auth, shadcn/ui (new-york/zinc), Tailwind CSS v4, Vite, Bun, Turborepo, oxlint, Prettier, Husky, commitlint, lint-staged

**Spec:** `docs/superpowers/specs/2026-03-26-excalibre-architecture-design.md`

**Reference project:** `/Users/pauldiloreto/Projects/allstarr` — the web app should follow the same patterns and conventions

**IMPORTANT:** Do NOT add "Co-Authored-By" lines to git commit messages.

---

### Task 1: Initialize Turborepo Monorepo

**Files:**

- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.npmrc`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "excalibre",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "lint:fix": "turbo lint:fix",
    "lint-staged": "lint-staged",
    "prepare": "husky",
    "test": "turbo test"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["oxlint --fix --config oxlint.config.ts"],
    "*.{js,jsx,ts,tsx,css,html,json,md,mdx,yaml,yml}": "prettier --write"
  },
  "devDependencies": {
    "@commitlint/cli": "^20.4.2",
    "@commitlint/config-conventional": "^20.4.2",
    "@commitlint/types": "^20.4.0",
    "@standard-config/oxlint": "^1.2.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "oxlint": "^1.49.0",
    "prettier": "^3.8.1",
    "turbo": "^2.5.4",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "outputs": [".output/**", "dist/**"],
      "dependsOn": ["^build"]
    },
    "lint": {},
    "lint:fix": {},
    "test": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
```

- [ ] **Step 3: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx"
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules
.output
dist/
.vinxi
.tanstack
.turbo

# Data
data/

# Environment
.env

# Claude/Serena
.worktrees/
.serena/
.playwright-mcp/
.claude/worktrees/
.claude/sessions/
.claude/plans/
.superpowers/

# Test artifacts
test-results/
playwright-report/
```

- [ ] **Step 5: Create .npmrc**

```
auto-install-peers=true
```

- [ ] **Step 6: Create empty directories**

Run: `mkdir -p apps/web apps/docs packages`

- [ ] **Step 7: Install dependencies**

Run: `bun install`

- [ ] **Step 8: Commit**

```bash
git add package.json turbo.json tsconfig.json .gitignore .npmrc bun.lock
git commit -m "feat: initialize turborepo monorepo"
```

---

### Task 2: Dev Tooling (Oxlint, Prettier, Commitlint, Husky)

**Files:**

- Create: `oxlint.config.ts`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `commitlint.config.ts`
- Create: `.husky/pre-commit`
- Create: `.husky/commit-msg`

- [ ] **Step 1: Create oxlint.config.ts**

```typescript
import { defineConfig } from "@standard-config/oxlint";

export default defineConfig({
  react: true,
  ignorePatterns: [
    "node_modules/**",
    ".output/**",
    "dist/**",
    "**/routeTree.gen.ts",
  ],
  rules: {
    "typescript/no-restricted-types": "off",
    "eslint/no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "react",
            importNames: ["default"],
            message: "Use named imports from 'react' instead",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: [
        "apps/web/src/routes/**",
        "apps/web/src/db/**",
        "apps/web/src/lib/auth.ts",
      ],
      rules: { "import/prefer-default-export": "off" },
    },
  ],
});
```

- [ ] **Step 2: Create .prettierrc**

```json
{}
```

- [ ] **Step 3: Create .prettierignore**

```
**/routeTree.gen.ts
.output
dist
node_modules
.turbo
```

- [ ] **Step 4: Create commitlint.config.ts**

```typescript
import type { UserConfig } from "@commitlint/types";
import { RuleConfigSeverity } from "@commitlint/types";

const Configuration: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-empty": [RuleConfigSeverity.Error, "always"],
  },
};

export default Configuration;
```

- [ ] **Step 5: Initialize husky**

Run: `bunx husky init`

- [ ] **Step 6: Create .husky/pre-commit**

```bash
bun run lint-staged
```

- [ ] **Step 7: Create .husky/commit-msg**

```bash
bunx commitlint --edit $1
```

- [ ] **Step 8: Verify lint works**

Run: `bun x --bun oxlint . && prettier --check .`
Expected: passes with no errors (nothing to lint yet except configs)

- [ ] **Step 9: Commit**

```bash
git add oxlint.config.ts .prettierrc .prettierignore commitlint.config.ts .husky/
git commit -m "feat: add dev tooling (oxlint, prettier, commitlint, husky)"
```

---

### Task 3: Scaffold TanStack Start Web App

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/lib/bun-sqlite-browser-shim.ts`
- Create: `apps/web/src/lib/query-client.ts`
- Create: `apps/web/src/router.tsx`
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/styles/app.css`

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@excalibre/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --bun vite dev",
    "build": "bun --bun vite build",
    "start": "bun .output/server/index.mjs",
    "lint": "bun x --bun oxlint . && prettier --check .",
    "lint:fix": "bun x --bun oxlint --fix . && prettier --write .",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@tanstack/react-query": "^5.90.21",
    "@tanstack/react-router": "^1.159.10",
    "@tanstack/react-router-ssr-query": "^1.162.8",
    "@tanstack/react-start": "^1.159.11",
    "better-auth": "^1.4.18",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "drizzle-orm": "^0.45.1",
    "lucide-react": "^0.564.0",
    "next-themes": "^0.4.6",
    "nitro": "^3.0.1-20260219-081345-4df7aab2",
    "radix-ui": "^1.4.3",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-hook-form": "^7.71.1",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.4.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.18",
    "@tanstack/react-query-devtools": "^5.91.3",
    "@types/better-sqlite3": "^7.6.13",
    "@types/bun": "^1.2.10",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.4",
    "better-sqlite3": "^12.8.0",
    "drizzle-kit": "^0.31.9",
    "tailwindcss": "^4.1.18",
    "vite": "^7.3.1",
    "vite-tsconfig-paths": "^6.1.1",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 2: Create apps/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "src/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/web/src/lib/bun-sqlite-browser-shim.ts**

This no-op shim prevents bun:sqlite from crashing on the client during hydration.

```typescript
// No-op shim for bun:sqlite in client bundles.
// The real module is only available on the server (SSR).
// This file is resolved by the Vite plugin for non-SSR imports.
export class Database {
  constructor() {
    throw new Error("bun:sqlite is not available in the browser");
  }
}
export default Database;
```

- [ ] **Step 4: Create apps/web/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import path from "node:path";

const shimPath = path.resolve("src/lib/bun-sqlite-browser-shim.ts");

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 3000,
    host: true,
    allowedHosts: ["excalibre", "host.docker.internal"],
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: "bun-sqlite-shim",
          setup(build) {
            build.onResolve({ filter: /^bun:sqlite$/ }, () => ({
              path: shimPath,
            }));
          },
        },
      ],
    },
  },
  plugins: [
    {
      name: "bun-sqlite-browser-shim",
      enforce: "pre",
      resolveId(id, _importer, options) {
        if (id === "bun:sqlite" && !options?.ssr) {
          return shimPath;
        }
      },
    },
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
});
```

- [ ] **Step 5: Create apps/web/src/lib/query-client.ts**

```typescript
// oxlint-disable import/prefer-default-export
import { QueryClient } from "@tanstack/react-query";

let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  // oxlint-disable-next-line no-typeof-undefined
  if (typeof globalThis.window === "undefined") {
    return new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000 },
      },
    });
  }

  if (!browserClient) {
    browserClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000 },
      },
    });
  }

  return browserClient;
}
```

- [ ] **Step 6: Create apps/web/src/router.tsx**

```typescript
import { createRouter } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";
import { getQueryClient } from "./lib/query-client";

export function getRouter(): AnyRouter {
  const queryClient = getQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
```

- [ ] **Step 7: Create apps/web/src/styles/app.css**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme {
  --color-background: hsl(224 71% 4%);
  --color-foreground: hsl(213 31% 91%);
  --color-card: hsl(224 71% 4%);
  --color-card-foreground: hsl(213 31% 91%);
  --color-popover: hsl(224 71% 4%);
  --color-popover-foreground: hsl(213 31% 91%);
  --color-primary: hsl(210 40% 98%);
  --color-primary-foreground: hsl(222.2 47.4% 11.2%);
  --color-secondary: hsl(222.2 47.4% 11.2%);
  --color-secondary-foreground: hsl(210 40% 98%);
  --color-muted: hsl(223 47% 11%);
  --color-muted-foreground: hsl(215.4 16.3% 56.9%);
  --color-accent: hsl(216 34% 17%);
  --color-accent-foreground: hsl(210 40% 98%);
  --color-destructive: hsl(0 63% 31%);
  --color-destructive-foreground: hsl(210 40% 98%);
  --color-border: hsl(216 34% 17%);
  --color-input: hsl(216 34% 17%);
  --color-ring: hsl(216 34% 17%);
  --color-sidebar: hsl(224 71% 4%);
  --color-sidebar-foreground: hsl(213 31% 91%);
  --color-sidebar-primary: hsl(210 40% 98%);
  --color-sidebar-primary-foreground: hsl(222.2 47.4% 11.2%);
  --color-sidebar-accent: hsl(216 34% 17%);
  --color-sidebar-accent-foreground: hsl(210 40% 98%);
  --color-sidebar-border: hsl(216 34% 17%);
  --color-sidebar-ring: hsl(216 34% 17%);
  --color-chart-1: hsl(220 70% 50%);
  --color-chart-2: hsl(160 60% 45%);
  --color-chart-3: hsl(30 80% 55%);
  --color-chart-4: hsl(280 65% 60%);
  --color-chart-5: hsl(340 75% 55%);
  --radius: 0.5rem;
}

:root {
  --sidebar: hsl(0 0% 98%);
  --sidebar-foreground: hsl(240 5.3% 26.1%);
  --sidebar-primary: hsl(240 5.9% 10%);
  --sidebar-primary-foreground: hsl(0 0% 98%);
  --sidebar-accent: hsl(240 4.8% 95.9%);
  --sidebar-accent-foreground: hsl(240 5.9% 10%);
  --sidebar-border: hsl(220 13% 91%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);
}

.dark {
  --sidebar: hsl(240 5.9% 10%);
  --sidebar-foreground: hsl(240 4.8% 95.9%);
  --sidebar-primary: hsl(224.3 76.3% 48%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(240 3.7% 15.9%);
  --sidebar-accent-foreground: hsl(240 4.8% 95.9%);
  --sidebar-border: hsl(240 3.7% 15.9%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);
}

@theme inline {
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 8: Create apps/web/src/routes/\_\_root.tsx**

```typescript
/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "src/styles/app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Excalibre" },
      ],
      links: [{ rel: "stylesheet", href: appCss }],
    }),
    component: RootComponent,
  },
);

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Install dependencies and verify**

Run from repo root:

```bash
bun install
```

Then from `apps/web`:

```bash
cd apps/web && bun run dev
```

Expected: Vite dev server starts on port 3000, TanStack Router generates `routeTree.gen.ts`. The page should render (it may show a blank page or error about missing routes — that's fine, the scaffold is working).

Stop the dev server after verifying.

- [ ] **Step 10: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold TanStack Start web app"
```

---

### Task 4: shadcn/ui Setup

**Files:**

- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts`
- Install shadcn/ui components via CLI

- [ ] **Step 1: Create apps/web/components.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/app.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "src/components",
    "utils": "src/lib/utils",
    "ui": "src/components/ui",
    "lib": "src/lib",
    "hooks": "src/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 2: Create apps/web/src/lib/utils.ts**

```typescript
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Install base shadcn/ui components**

Run from `apps/web`:

```bash
bunx shadcn@latest add button input label card form sonner sidebar tooltip separator scroll-area skeleton badge dialog dropdown-menu select tabs textarea
```

If prompted for configuration, accept defaults. This creates component files in `src/components/ui/`.

- [ ] **Step 4: Verify components installed**

Check that `apps/web/src/components/ui/button.tsx` and other component files exist.

Run: `ls apps/web/src/components/ui/`
Expected: Multiple `.tsx` files for each installed component.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components.json apps/web/src/lib/utils.ts apps/web/src/components/ui/
git commit -m "feat: add shadcn/ui component library"
```

---

### Task 5: Database Schema (Drizzle ORM)

**Files:**

- Create: `apps/web/drizzle.config.ts`
- Create: `apps/web/src/db/index.ts`
- Create: `apps/web/src/db/schema/index.ts`
- Create: `apps/web/src/db/schema/auth.ts`
- Create: `apps/web/src/db/schema/libraries.ts`
- Create: `apps/web/src/db/schema/books.ts`
- Create: `apps/web/src/db/schema/reading.ts`
- Create: `apps/web/src/db/schema/organization.ts`
- Create: `apps/web/src/db/schema/jobs.ts`

- [ ] **Step 1: Create apps/web/drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || "data/sqlite.db",
  },
});
```

- [ ] **Step 2: Create apps/web/src/db/schema/auth.ts**

These tables match better-auth's expected schema for SQLite with the Drizzle adapter.

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
```

- [ ] **Step 3: Create apps/web/src/db/schema/libraries.ts**

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const libraries = sqliteTable("libraries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["book", "comic", "manga"] })
    .notNull()
    .default("book"),
  coverImage: text("cover_image"),
  scanPaths: text("scan_paths", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  scanInterval: integer("scan_interval").notNull().default(30),
  lastScannedAt: integer("last_scanned_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const libraryAccess = sqliteTable("library_access", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  libraryId: integer("library_id")
    .notNull()
    .references(() => libraries.id, { onDelete: "cascade" }),
});
```

- [ ] **Step 4: Create apps/web/src/db/schema/books.ts**

```typescript
import {
  sqliteTable,
  text,
  integer,
  real,
  unique,
} from "drizzle-orm/sqlite-core";
import { libraries } from "./libraries";

export const series = sqliteTable("series", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortName: text("sort_name").notNull(),
  libraryId: integer("library_id")
    .notNull()
    .references(() => libraries.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const authors = sqliteTable("authors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortName: text("sort_name").notNull(),
  slug: text("slug"),
  bio: text("bio"),
  coverPath: text("cover_path"),
  hardcoverId: text("hardcover_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  sortTitle: text("sort_title").notNull(),
  slug: text("slug"),
  libraryId: integer("library_id")
    .notNull()
    .references(() => libraries.id, { onDelete: "cascade" }),
  description: text("description"),
  language: text("language"),
  publisher: text("publisher"),
  publishDate: text("publish_date"),
  isbn10: text("isbn10"),
  isbn13: text("isbn13"),
  pageCount: integer("page_count"),
  coverPath: text("cover_path"),
  hardcoverId: text("hardcover_id"),
  googleBooksId: text("google_books_id"),
  seriesId: integer("series_id").references(() => series.id, {
    onDelete: "set null",
  }),
  seriesIndex: real("series_index"),
  rating: real("rating"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const booksAuthors = sqliteTable(
  "books_authors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["author", "editor", "translator", "illustrator"],
    })
      .notNull()
      .default("author"),
  },
  (t) => [unique().on(t.bookId, t.authorId, t.role)],
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const booksTags = sqliteTable(
  "books_tags",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.bookId, t.tagId)],
);

export const bookFiles = sqliteTable("book_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  format: text("format").notNull(),
  fileSize: integer("file_size"),
  fileHash: text("file_hash"),
  md5Hash: text("md5_hash"),
  source: text("source", { enum: ["scanned", "uploaded", "converted"] })
    .notNull()
    .default("scanned"),
  volumeType: text("volume_type", { enum: ["data", "excalibre"] })
    .notNull()
    .default("data"),
  discoveredAt: integer("discovered_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  modifiedAt: integer("modified_at", { mode: "timestamp" }),
});
```

- [ ] **Step 5: Create apps/web/src/db/schema/reading.ts**

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { books } from "./books";

export const readingProgress = sqliteTable("reading_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  deviceType: text("device_type", { enum: ["web", "koreader", "kobo"] })
    .notNull()
    .default("web"),
  deviceId: text("device_id"),
  progress: real("progress").notNull().default(0),
  position: text("position"),
  isFinished: integer("is_finished", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const annotations = sqliteTable("annotations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["highlight", "note", "bookmark"] })
    .notNull()
    .default("highlight"),
  position: text("position"),
  content: text("content"),
  note: text("note"),
  color: text("color"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

- [ ] **Step 6: Create apps/web/src/db/schema/organization.ts**

```typescript
import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { books } from "./books";

export const shelves = sqliteTable("shelves", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["smart", "manual"] })
    .notNull()
    .default("manual"),
  filterRules: text("filter_rules", { mode: "json" }).$type<
    Record<string, unknown>
  >(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const shelvesBooks = sqliteTable(
  "shelves_books",
  {
    shelfId: integer("shelf_id")
      .notNull()
      .references(() => shelves.id, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.shelfId, t.bookId)],
);

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  coverImage: text("cover_image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const collectionsBooks = sqliteTable(
  "collections_books",
  {
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.collectionId, t.bookId)],
);

export const readingLists = sqliteTable("reading_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const readingListBooks = sqliteTable(
  "reading_list_books",
  {
    readingListId: integer("reading_list_id")
      .notNull()
      .references(() => readingLists.id, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [unique().on(t.readingListId, t.bookId)],
);
```

- [ ] **Step 7: Create apps/web/src/db/schema/jobs.ts**

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["scan", "convert", "epub_fix"] }).notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
  result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
  error: text("error"),
  priority: integer("priority").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

- [ ] **Step 8: Create apps/web/src/db/schema/index.ts**

```typescript
export * from "./auth";
export * from "./libraries";
export * from "./books";
export * from "./reading";
export * from "./organization";
export * from "./jobs";
```

- [ ] **Step 9: Create apps/web/src/db/index.ts**

```typescript
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_URL || "data/sqlite.db");
sqlite.run(`PRAGMA journal_mode = ${process.env.SQLITE_JOURNAL_MODE || "WAL"}`);
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle({ client: sqlite, schema });
```

- [ ] **Step 10: Create data directory and generate initial migration**

Run from `apps/web`:

```bash
mkdir -p data
bun run db:generate
```

Expected: Migration files created in `apps/web/drizzle/` directory.

- [ ] **Step 11: Apply migration**

Run from `apps/web`:

```bash
bun run db:push
```

Expected: All tables created in `data/sqlite.db`.

- [ ] **Step 12: Commit**

```bash
git add apps/web/drizzle.config.ts apps/web/src/db/ apps/web/drizzle/
git commit -m "feat: add database schema with Drizzle ORM"
```

---

### Task 6: better-auth Setup

**Files:**

- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/auth-client.ts`
- Create: `apps/web/src/server/middleware.ts`
- Create: `apps/web/src/routes/api/auth/$.ts`
- Create: `apps/web/.env.example`
- Create: `apps/web/.env`

- [ ] **Step 1: Create apps/web/.env.example**

```
DATABASE_URL=data/sqlite.db
BETTER_AUTH_SECRET=your-secret-key-change-this
BETTER_AUTH_URL=http://localhost:3000

# OIDC (optional — omit to disable)
# OIDC_ISSUER=https://auth.example.com
# OIDC_CLIENT_ID=excalibre
# OIDC_CLIENT_SECRET=secret
# OIDC_SCOPES=openid,profile,email
# OIDC_AUTO_CREATE_USERS=true
# DEFAULT_LIBRARY_IDS=1,2
```

- [ ] **Step 2: Create apps/web/.env**

```
DATABASE_URL=data/sqlite.db
BETTER_AUTH_SECRET=dev-secret-change-in-production
BETTER_AUTH_URL=http://localhost:3000
```

- [ ] **Step 3: Create apps/web/src/lib/auth.ts**

```typescript
// oxlint-disable import/prefer-default-export
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "src/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
});
```

- [ ] **Step 4: Create apps/web/src/lib/auth-client.ts**

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
```

- [ ] **Step 5: Create apps/web/src/server/middleware.ts**

```typescript
import { createServerFn } from "@tanstack/react-start";
import { auth } from "src/lib/auth";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { libraryAccess } from "src/db/schema";

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const request = getRequest();
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return session;
  },
);

export async function requireAuth() {
  const session = await getAuthSessionFn();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "admin") {
    throw new Error("Forbidden: admin access required");
  }
  return session;
}

export async function requireLibraryAccess(libraryId: number) {
  const session = await requireAuth();
  if (session.user.role === "admin") {
    return session;
  }
  const access = await db.query.libraryAccess.findFirst({
    where: and(
      eq(libraryAccess.userId, session.user.id),
      eq(libraryAccess.libraryId, libraryId),
    ),
  });
  if (!access) {
    throw new Error("Forbidden: no access to this library");
  }
  return session;
}
```

- [ ] **Step 6: Create apps/web/src/routes/api/auth/$.ts**

```typescript
// oxlint-disable import/prefer-default-export
import { auth } from "src/lib/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
    },
  },
});
```

- [ ] **Step 7: Verify auth route registers**

Run from `apps/web`:

```bash
bun run dev
```

Expected: Dev server starts. The route tree should now include `/api/auth/$`. Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add apps/web/.env.example apps/web/src/lib/auth.ts apps/web/src/lib/auth-client.ts apps/web/src/server/middleware.ts apps/web/src/routes/api/auth/
git commit -m "feat: add better-auth with email/password authentication"
```

---

### Task 7: Login & Register Pages

**Files:**

- Create: `apps/web/src/routes/login.tsx`
- Create: `apps/web/src/routes/register.tsx`
- Create: `apps/web/src/routes/_authed.tsx`
- Create: `apps/web/src/routes/_authed/index.tsx`

- [ ] **Step 1: Create apps/web/src/routes/login.tsx**

```typescript
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { signIn } from "src/lib/auth-client";
import { Button } from "src/components/ui/button";
import Input from "src/components/ui/input";
import Label from "src/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "src/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        toast.error(result.error.message || "Failed to sign in");
      } else {
        navigate({ to: "/" });
      }
    } catch {
      toast.error("Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Excalibre</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="mt-6 flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="text-primary underline">
                Register
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create apps/web/src/routes/register.tsx**

```typescript
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { signUp } from "src/lib/auth-client";
import { Button } from "src/components/ui/button";
import Input from "src/components/ui/input";
import Label from "src/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "src/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        toast.error(result.error.message || "Failed to register");
      } else {
        toast.success("Account created! Signing in...");
        navigate({ to: "/" });
      }
    } catch {
      toast.error("Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Register for a new Excalibre account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </CardContent>
          <CardFooter className="mt-6 flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary underline">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create apps/web/src/routes/\_authed.tsx**

```typescript
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthSessionFn } from "src/server/middleware";
import AppLayout from "src/components/layout/app-layout";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ location }) => {
    const session = await getAuthSessionFn();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    return { session };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
```

- [ ] **Step 4: Create apps/web/src/routes/\_authed/index.tsx**

A simple home page stub that redirects or shows a placeholder.

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome to Excalibre</h1>
      <p className="mt-2 text-muted-foreground">
        Your library is empty. Go to Settings → Libraries to add a library and
        start scanning for books.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Add Sonner/Toaster to root layout**

Update `apps/web/src/routes/__root.tsx` — add the Sonner toast provider. Replace the `RootComponent` function:

Find the import section and add:

```typescript
import Toaster from "src/components/ui/sonner";
```

Then update `RootComponent` to include `<Toaster />`:

```typescript
function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
      <Toaster />
    </RootDocument>
  );
}
```

- [ ] **Step 6: Verify auth flow works**

Run from `apps/web`:

```bash
bun run dev
```

1. Visit `http://localhost:3000` — should redirect to `/login`
2. Click "Register" → create an account
3. Should redirect to `/` showing the home page stub
4. Reload — should stay on `/` (session persisted)

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/
git commit -m "feat: add login, register, and auth guard"
```

---

### Task 8: App Shell Layout (Sidebar + Header)

**Files:**

- Create: `apps/web/src/components/layout/app-layout.tsx`
- Create: `apps/web/src/components/layout/app-sidebar.tsx`
- Create: `apps/web/src/components/layout/header.tsx`
- Create: `apps/web/src/lib/query-keys.ts`

- [ ] **Step 1: Create apps/web/src/lib/query-keys.ts**

```typescript
// oxlint-disable import/prefer-default-export
export const queryKeys = {
  libraries: {
    all: ["libraries"] as const,
    list: () => ["libraries", "list"] as const,
    detail: (id: number) => ["libraries", "detail", id] as const,
  },
  books: {
    all: ["books"] as const,
    list: (libraryId: number) => ["books", "list", libraryId] as const,
    detail: (id: number) => ["books", "detail", id] as const,
  },
  authors: {
    all: ["authors"] as const,
    detail: (id: number) => ["authors", "detail", id] as const,
  },
  series: {
    all: ["series"] as const,
    detail: (id: number) => ["series", "detail", id] as const,
  },
  shelves: {
    all: ["shelves"] as const,
    detail: (id: number) => ["shelves", "detail", id] as const,
  },
  collections: {
    all: ["collections"] as const,
    detail: (id: number) => ["collections", "detail", id] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    list: () => ["jobs", "list"] as const,
  },
};
```

- [ ] **Step 2: Create apps/web/src/components/layout/header.tsx**

```typescript
import type { JSX } from "react";
import { SidebarTrigger } from "src/components/ui/sidebar";
import { Separator } from "src/components/ui/separator";

export default function Header(): JSX.Element {
  return (
    <header className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
    </header>
  );
}
```

- [ ] **Step 3: Create apps/web/src/components/layout/app-sidebar.tsx**

```typescript
import type { JSX } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Home,
  Library,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "src/components/ui/sidebar";
import { useSession, signOut } from "src/lib/auth-client";
import { Button } from "src/components/ui/button";

export default function AppSidebar(): JSX.Element {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { data: sessionData } = useSession();

  return (
    <Sidebar>
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-4">
        <Link to="/" className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          <span className="text-lg font-bold">Excalibre</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={currentPath === "/"}>
                  <Link to="/">
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Libraries</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled>
                  <Library className="h-4 w-4" />
                  <span className="text-muted-foreground">No libraries yet</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {sessionData?.user?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath.startsWith("/settings")}
                  >
                    <Link to="/settings/general">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-muted-foreground">
            {sessionData?.user?.email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
          >
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 4: Create apps/web/src/components/layout/app-layout.tsx**

```typescript
import type { ReactNode, JSX } from "react";
import { SidebarProvider } from "src/components/ui/sidebar";
import { TooltipProvider } from "src/components/ui/tooltip";
import AppSidebar from "./app-sidebar";
import Header from "./header";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps): JSX.Element {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1 overflow-x-hidden p-4 sm:p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
```

- [ ] **Step 5: Verify layout renders**

Run from `apps/web`:

```bash
bun run dev
```

Visit `http://localhost:3000`. After login, you should see:

- Sidebar on the left with "Excalibre" header, Home link, empty Libraries section, Settings link (if admin), and user email + sign out at the bottom
- Header bar with sidebar toggle
- Main content area showing the home page stub

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/ apps/web/src/lib/query-keys.ts
git commit -m "feat: add app shell with sidebar and header"
```

---

### Task 9: Admin Settings Stubs

**Files:**

- Create: `apps/web/src/routes/_authed/settings/general.tsx`
- Create: `apps/web/src/routes/_authed/settings/libraries.tsx`
- Create: `apps/web/src/routes/_authed/settings/users.tsx`
- Create: `apps/web/src/routes/_authed/settings/scanning.tsx`
- Create: `apps/web/src/routes/_authed/settings/jobs.tsx`

- [ ] **Step 1: Create apps/web/src/routes/\_authed/settings/general.tsx**

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/general")({
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">General Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Server configuration and authentication status.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create apps/web/src/routes/\_authed/settings/libraries.tsx**

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/libraries")({
  component: LibrarySettingsPage,
});

function LibrarySettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Libraries</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your book libraries and scan paths.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create apps/web/src/routes/\_authed/settings/users.tsx**

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/users")({
  component: UserSettingsPage,
});

function UserSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="mt-2 text-muted-foreground">
        Manage users and library access.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create apps/web/src/routes/\_authed/settings/scanning.tsx**

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/scanning")({
  component: ScanningSettingsPage,
});

function ScanningSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Scanning</h1>
      <p className="mt-2 text-muted-foreground">
        Configure scan intervals and trigger manual scans.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Create apps/web/src/routes/\_authed/settings/jobs.tsx**

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/jobs")({
  component: JobsPage,
});

function JobsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Jobs</h1>
      <p className="mt-2 text-muted-foreground">
        Monitor background job queue.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/_authed/settings/
git commit -m "feat: add admin settings page stubs"
```

---

### Task 10: Docker Setup

**Files:**

- Create: `Dockerfile`
- Create: `compose.yml`
- Create: `scripts/docker-entrypoint.sh`
- Create: `apps/web/src/db/migrate.ts`

- [ ] **Step 1: Create apps/web/src/db/migrate.ts**

```typescript
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const sqlite = new Database(process.env.DATABASE_URL || "data/sqlite.db");
sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA foreign_keys = ON");

const db = drizzle({ client: sqlite });

console.log("Running migrations...");
migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete.");

sqlite.close();
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
# Stage 1: Build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json apps/web/

# Install all dependencies
RUN bun install --frozen-lockfile --ignore-scripts

# Copy source
COPY apps/web/ apps/web/
COPY tsconfig.json ./

# Build the web app
RUN cd apps/web && bun run build

# Stage 2: Runtime
FROM oven/bun:1-alpine

WORKDIR /app

# Install conversion tools
RUN apk add --no-cache pandoc

# Install kepubify (detect architecture)
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      wget -O /usr/local/bin/kepubify https://github.com/pgaskin/kepubify/releases/latest/download/kepubify-linux-arm64; \
    else \
      wget -O /usr/local/bin/kepubify https://github.com/pgaskin/kepubify/releases/latest/download/kepubify-linux-64bit; \
    fi && chmod +x /usr/local/bin/kepubify

# Copy Nitro server output
COPY --from=builder /app/apps/web/.output ./.output

# Copy package files for production deps
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
RUN bun install --production --ignore-scripts

# Copy DB config, migrations, and migrate script
COPY --from=builder /app/apps/web/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/apps/web/src/db ./src/db
COPY --from=builder /app/apps/web/drizzle ./drizzle

# Copy entrypoint
COPY scripts/docker-entrypoint.sh /app/scripts/
RUN chmod +x /app/scripts/docker-entrypoint.sh

# Create directories
RUN mkdir -p /app/excalibre /app/data

ENV DATABASE_URL=/app/excalibre/sqlite.db
ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
```

- [ ] **Step 3: Create scripts/docker-entrypoint.sh**

```bash
#!/bin/sh
set -e

echo "Excalibre - Starting up..."

# Ensure directories exist
mkdir -p /app/excalibre /app/data

# Apply database migrations
echo "Running database migrations..."
bun /app/src/db/migrate.ts

# Start the application
echo "Starting Excalibre..."
exec bun /app/.output/server/index.mjs
```

- [ ] **Step 4: Create compose.yml**

```yaml
services:
  excalibre:
    build: .
    container_name: excalibre
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data:ro
      - ./excalibre-data:/app/excalibre
    environment:
      - BETTER_AUTH_SECRET=change-me-in-production
      - BETTER_AUTH_URL=http://localhost:3000
      # Optional OIDC
      # - OIDC_ISSUER=https://auth.example.com
      # - OIDC_CLIENT_ID=excalibre
      # - OIDC_CLIENT_SECRET=secret
    restart: unless-stopped
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile compose.yml scripts/ apps/web/src/db/migrate.ts
git commit -m "feat: add Docker deployment setup"
```

---

### Task 11: Starlight Docs Site

**Files:**

- Create: `apps/docs/package.json`
- Create: `apps/docs/astro.config.mjs`
- Create: `apps/docs/tsconfig.json`
- Create: `apps/docs/src/content/docs/index.mdx`
- Create: `apps/docs/src/content/docs/getting-started.mdx`

- [ ] **Step 1: Scaffold Starlight docs site**

Run from repo root:

```bash
cd apps && bunx create-starlight@latest docs -- --template basics --no-install --package-manager bun
```

If the CLI doesn't support all flags, create the files manually in the following steps.

- [ ] **Step 2: Ensure apps/docs/package.json exists**

If the scaffold didn't create it, create it manually:

```json
{
  "name": "@excalibre/docs",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/starlight": "^0.34.5",
    "astro": "^5.9.3",
    "sharp": "^0.33.5"
  }
}
```

- [ ] **Step 3: Ensure apps/docs/astro.config.mjs exists**

```javascript
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "Excalibre Docs",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/your-username/excalibre",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "" },
            { label: "Installation", slug: "getting-started" },
          ],
        },
      ],
    }),
  ],
});
```

- [ ] **Step 4: Ensure apps/docs/tsconfig.json exists**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": ["src"]
}
```

- [ ] **Step 5: Create apps/docs/src/content/docs/index.mdx**

```mdx
---
title: Excalibre
description: A modern, self-hosted ebook library manager and web reader.
---

Excalibre is a modern rewrite of Calibre Web Automated — a self-hosted ebook library manager with an in-browser reader, no Calibre dependency required.

## Features

- **Multi-format web reader** — Read EPUB, MOBI, AZW3, PDF, CBZ, and more directly in your browser
- **Automatic library scanning** — Discovers books in your data directory without modifying file structure
- **User-driven metadata** — Enhance book metadata from Hardcover and Google Books on your terms
- **Format conversion** — Convert between ebook formats using pandoc
- **Multi-user with OIDC** — Library-scoped access control with OpenID Connect support
- **Device sync** — KOReader (KOSync), Kobo, and OPDS support
- **Reading progress** — Per-device tracking with cross-device merge

## Quick Start

See the [Getting Started](/getting-started) guide to install Excalibre with Docker.
```

- [ ] **Step 6: Create apps/docs/src/content/docs/getting-started.mdx**

````mdx
---
title: Getting Started
description: Install and run Excalibre with Docker.
---

## Prerequisites

- Docker and Docker Compose installed
- A directory containing your ebook files

## Installation

Create a `compose.yml` file:

```yaml
services:
  excalibre:
    image: excalibre:latest
    ports:
      - "3000:3000"
    volumes:
      - /path/to/your/books:/app/data:ro
      - excalibre-data:/app/excalibre
    environment:
      - BETTER_AUTH_SECRET=generate-a-random-secret
      - BETTER_AUTH_URL=http://localhost:3000
    restart: unless-stopped

volumes:
  excalibre-data:
```
````

Then run:

```bash
docker compose up -d
```

Visit `http://localhost:3000` to create your admin account.

````

- [ ] **Step 7: Install docs dependencies**

Run from repo root:
```bash
bun install
````

- [ ] **Step 8: Verify docs site**

Run from `apps/docs`:

```bash
bun run dev
```

Expected: Astro dev server starts, showing the Starlight documentation site. Stop after verifying.

- [ ] **Step 9: Commit**

```bash
git add apps/docs/
git commit -m "feat: add Starlight documentation site"
```

---

### Task 12: CLAUDE.md and Final Verification

**Files:**

- Create: `CLAUDE.md`
- Create: `AGENTS.md` (symlink to CLAUDE.md)

- [ ] **Step 1: Create CLAUDE.md**

````markdown
# CLAUDE.md

## Project Overview

Excalibre is a self-hosted ebook library manager and web reader — a modern, Calibre-free rewrite of Calibre Web Automated. Built as a Turborepo monorepo.

## Quick Commands

```bash
# Development
bun run dev              # Start all apps (web + docs)
cd apps/web && bun run dev  # Start web app only

# Database
cd apps/web
bun run db:generate      # Generate migrations from schema changes
bun run db:migrate       # Apply migrations
bun run db:push          # Push schema directly (dev only)
bun run db:studio        # Open Drizzle Studio

# Linting
bun run lint             # Check all
bun run lint:fix         # Auto-fix

# Testing
bun run test             # Run all tests
```
````

## Environment Variables

See `apps/web/.env.example` for all available variables.

Required:

- `BETTER_AUTH_SECRET` — Auth encryption secret
- `BETTER_AUTH_URL` — Base URL of the app

## Architecture

- **Monorepo:** Turborepo with `apps/web` (TanStack Start) and `apps/docs` (Starlight)
- **Stack:** TanStack Start, TanStack Router (file-based), React Query v5, Drizzle ORM, SQLite (bun:sqlite), better-auth, shadcn/ui, Tailwind CSS v4
- **Runtime:** Bun
- **Deployment:** Docker (single container)

## Data Flow

1. Server functions in `apps/web/src/server/` use `createServerFn` from TanStack Start
2. Every authenticated server function calls `requireAuth()` (or `requireLibraryAccess()`) first
3. Database queries use Drizzle ORM via `db` instance from `src/db/index.ts`
4. Client fetches via React Query, keys centralized in `src/lib/query-keys.ts`

## Route Structure

- `src/routes/__root.tsx` — HTML shell
- `src/routes/_authed.tsx` — Auth guard (redirects to /login)
- `src/routes/_authed/**` — All authenticated pages
- `src/routes/api/auth/$.ts` — better-auth catch-all

## Key Conventions

- Dark mode is hardcoded (`.dark` class on `<html>`)
- shadcn/ui: new-york style, zinc base color
- Do NOT edit `routeTree.gen.ts` — auto-generated by TanStack Router
- Schema files: one per entity in `src/db/schema/`
- Barrel export all schema from `src/db/schema/index.ts`

## Volumes (Docker)

- `/app/data` — Read-only. Shared book library. Never modify files here.
- `/app/excalibre` — Read-write. SQLite DB, covers, conversions, uploads.

## Design Spec

See `docs/superpowers/specs/2026-03-26-excalibre-architecture-design.md`

````

- [ ] **Step 2: Create AGENTS.md symlink**

Run: `ln -s CLAUDE.md AGENTS.md`

- [ ] **Step 3: Full verification**

Run from repo root:
```bash
bun install
cd apps/web && bun run dev
````

Verify:

1. Dev server starts on port 3000
2. Visit `/` — redirects to `/login`
3. Register a new account — redirects to `/` with sidebar layout
4. Sidebar shows: Home, Libraries (empty), Settings (admin)
5. Click Settings → General — shows stub page
6. Sign out → returns to login page

Stop the dev server.

- [ ] **Step 4: Run lint**

```bash
cd /path/to/excalibre && bun run lint
```

Expected: passes (or only minor warnings from generated files).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: add CLAUDE.md project guidance"
```
