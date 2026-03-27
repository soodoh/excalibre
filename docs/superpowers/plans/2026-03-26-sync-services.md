# Sync Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement KOSync (KOReader progress sync), OPDS + OPDS-PSE catalog feeds, and Kobo device sync — enabling Excalibre to work with KOReader, Kobo e-readers, and any OPDS-compatible client.

**Architecture:** Each protocol is implemented as a set of API routes under its own prefix (`/api/kosync/*`, `/opds/*`, `/api/kobo/:token/*`). KOSync uses HTTP header auth (x-auth-user/x-auth-key) mapping to Excalibre users. OPDS uses HTTP Basic Auth or API key in URL. Kobo uses a per-user auth token in the URL path. All protocols store reading progress in the existing `readingProgress` table with appropriate `deviceType`.

**Tech Stack:** TanStack Start API routes (server handlers), Drizzle ORM, fast-xml-parser (OPDS XML generation), existing readingProgress/bookFiles/books schema

**Spec:** `docs/superpowers/specs/2026-03-26-excalibre-architecture-design.md` — Sync Services section

**IMPORTANT:** Do NOT add "Co-Authored-By" lines to git commit messages.

---

## File Structure

### New files

**KOSync:**

- `apps/web/src/routes/api/kosync/users.create.ts` — POST user registration
- `apps/web/src/routes/api/kosync/users.auth.ts` — GET user authentication
- `apps/web/src/routes/api/kosync/syncs.progress.ts` — PUT update + GET retrieve progress
- `apps/web/src/routes/api/kosync/healthcheck.ts` — GET health check
- `apps/web/src/server/kosync.ts` — KOSync helper functions (auth, document lookup)

**OPDS:**

- `apps/web/src/server/opds.ts` — OPDS feed generation helpers (Atom XML builders)
- `apps/web/src/routes/api/opds/index.ts` — GET root catalog
- `apps/web/src/routes/api/opds/all.ts` — GET all books feed
- `apps/web/src/routes/api/opds/recent.ts` — GET recently added feed
- `apps/web/src/routes/api/opds/libraries.$libraryId.ts` — GET library feed
- `apps/web/src/routes/api/opds/search.ts` — GET search results feed
- `apps/web/src/routes/api/opds/search.xml.ts` — GET OpenSearch descriptor
- `apps/web/src/routes/api/opds/pse.$bookId.$pageNumber.ts` — GET PSE page image

**Kobo:**

- `apps/web/src/server/kobo.ts` — Kobo sync helpers (token auth, sync token, metadata builders)
- `apps/web/src/routes/api/kobo/$token/v1/initialization.ts` — GET device init
- `apps/web/src/routes/api/kobo/$token/v1/library.sync.ts` — GET library sync
- `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.state.ts` — GET/PUT reading state
- `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.download.ts` — GET book download

**Settings:**

- `apps/web/src/routes/_authed/settings/sync.tsx` — Sync settings page (KOSync/Kobo/OPDS config)

**Schema:**

- `apps/web/src/db/schema/sync.ts` — Kobo device tokens, OPDS API keys

### Modified files

- `apps/web/src/db/schema/index.ts` — Export sync schema
- `apps/web/src/routes/_authed/settings/` — Add sync settings route

---

### Task 1: Sync Schema + KOSync Helpers

**Files:**

- Create: `apps/web/src/db/schema/sync.ts`
- Modify: `apps/web/src/db/schema/index.ts`
- Create: `apps/web/src/server/kosync.ts`

- [ ] **Step 1: Create sync schema**

Create `apps/web/src/db/schema/sync.ts`:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// Per-user Kobo auth token
export const koboTokens = sqliteTable("kobo_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  deviceName: text("device_name"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Per-user OPDS API key
export const opdsKeys = sqliteTable("opds_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  apiKey: text("api_key").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

Add `export * from "./sync";` to `apps/web/src/db/schema/index.ts`.

- [ ] **Step 2: Create KOSync helper functions**

Create `apps/web/src/server/kosync.ts`:

KOSync uses `x-auth-user` and `x-auth-key` headers for auth. The `x-auth-key` is an MD5 of the password. Since we use better-auth (not raw passwords), we map KOSync username to Excalibre user email, and verify via better-auth's session or a direct DB password check.

Simplest approach: KOSync users register with their Excalibre email as username and their Excalibre password. Auth verifies against better-auth's credential check.

Helper functions:

- `authenticateKosync(request: Request): Promise<{ userId: string } | null>` — extracts x-auth-user/x-auth-key, looks up user by email (username), verifies password hash against the account table
- `findBookByMd5(md5Hash: string): Promise<BookFile | null>` — looks up a book file by its MD5 hash from the bookFiles table

For password verification: better-auth stores hashed passwords in the `account` table (providerId="credential", password field). We need to verify the KOSync x-auth-key (which KOReader sends as an MD5 of the password) against the stored hash. Since better-auth uses bcrypt/scrypt (not MD5), we can't directly compare.

**Practical approach:** Accept the raw password in x-auth-key (KOReader sends MD5 of password, but we can configure KOReader to send the raw password if we document it), OR we store a separate KOSync password hash. Simplest: use better-auth's `verifyPassword` API if available, or create a dedicated KOSync credential in the user record.

**Simplest working approach:** Use the `x-auth-user` as email and `x-auth-key` as a plaintext password. Call better-auth's credential verification internally. If better-auth doesn't expose a direct password verify function, fall back to storing a separate KOSync password in the user table or a new column.

The implementer should check what better-auth exposes for password verification and use the simplest working approach. If stuck, store the x-auth-key as-is and compare directly (KOReader sends MD5 of password — store and compare that).

- [ ] **Step 3: Generate migration for sync tables**

Run from `apps/web`:

```bash
bun run db:generate
bun run db:push
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/db/schema/sync.ts apps/web/src/db/schema/index.ts apps/web/src/server/kosync.ts apps/web/drizzle/
git commit -m "feat: add sync schema and KOSync authentication helpers"
```

---

### Task 2: KOSync API Endpoints

**Files:**

- Create: `apps/web/src/routes/api/kosync/healthcheck.ts`
- Create: `apps/web/src/routes/api/kosync/users.create.ts`
- Create: `apps/web/src/routes/api/kosync/users.auth.ts`
- Create: `apps/web/src/routes/api/kosync/syncs.progress.ts`

- [ ] **Step 1: Create healthcheck endpoint**

Create `apps/web/src/routes/api/kosync/healthcheck.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/kosync/healthcheck")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ state: "OK" });
      },
    },
  },
});
```

- [ ] **Step 2: Create user registration endpoint**

Create `apps/web/src/routes/api/kosync/users.create.ts`:

POST `/api/kosync/users/create` — KOReader calls this to "register" a user. Since Excalibre manages its own users, this endpoint verifies that the provided credentials match an existing Excalibre user (by email as username). If valid, returns success. If no user found, returns 402.

Request body: `{ "username": "email@example.com", "password": "..." }`
Success: `201 { "username": "email@example.com" }`
Error: `402 { "message": "Username is already registered." }` (or user not found)

- [ ] **Step 3: Create user auth endpoint**

Create `apps/web/src/routes/api/kosync/users.auth.ts`:

GET `/api/kosync/users/auth` — Verifies x-auth-user and x-auth-key headers.
Success: `200 { "authorized": "OK" }`
Error: `401 { "message": "Unauthorized" }`

- [ ] **Step 4: Create progress sync endpoint**

Create `apps/web/src/routes/api/kosync/syncs.progress.ts`:

Handles both GET and PUT:

**GET** `/api/kosync/syncs/progress?document=<md5hash>`:

1. Authenticate via x-auth-user/x-auth-key
2. Look up bookFile by md5Hash
3. Look up readingProgress for this user + book + deviceType="koreader"
4. Return: `{ document, percentage, progress, device, device_id, timestamp }`
5. Return empty `{}` if no progress exists

**PUT** `/api/kosync/syncs/progress`:

1. Authenticate
2. Parse body: `{ document, progress, percentage, device, device_id }`
3. Look up bookFile by md5Hash (document field)
4. Upsert readingProgress for this user + book + deviceType="koreader"
5. Return: `{ document, timestamp }` where timestamp is Unix epoch seconds

- [ ] **Step 5: Add tests for KOSync endpoints**

Create `apps/web/src/__tests__/kosync.test.ts`:

Test the core helper functions:

- `findBookByMd5` returns correct book file
- `findBookByMd5` returns null for unknown hash
- KOSync auth parsing extracts headers correctly

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/api/kosync/ apps/web/src/__tests__/kosync.test.ts
git commit -m "feat: add KOSync API endpoints for KOReader sync"
```

---

### Task 3: OPDS Feed Helpers + Root Catalog

**Files:**

- Create: `apps/web/src/server/opds.ts`
- Create: `apps/web/src/routes/api/opds/index.ts`
- Create: `apps/web/src/routes/api/opds/search.xml.ts`

- [ ] **Step 1: Create OPDS XML builder helpers**

Create `apps/web/src/server/opds.ts`:

Helper functions for generating OPDS Atom XML feeds. Use string template literals (not a full XML library) for simplicity.

Functions:

- `opdsHeader(id, title, selfHref, updated?)` — returns the `<feed>` opening tag with namespaces, id, title, updated, author, self/start links
- `opdsFooter()` — returns `</feed>`
- `opdsNavigationEntry(id, title, href, content?)` — returns an `<entry>` for navigation feeds
- `opdsBookEntry(book, files, authors, baseUrl)` — returns an `<entry>` for acquisition feeds with:
  - Title, author(s), language, publisher, ISBN, summary
  - Cover image link (`/api/covers/${bookId}`)
  - Acquisition links for each file format
  - Categories/tags
- `opdsSearchLink(baseUrl)` — returns a `<link rel="search">` element
- `authenticateOpds(request: Request): Promise<{userId: string} | null>` — checks for HTTP Basic Auth or `?apikey=` query param, validates against opdsKeys table or user credentials

MIME type constants:

```typescript
const OPDS_NAVIGATION =
  "application/atom+xml;profile=opds-catalog;kind=navigation";
const OPDS_ACQUISITION =
  "application/atom+xml;profile=opds-catalog;kind=acquisition";
```

- [ ] **Step 2: Create root catalog**

Create `apps/web/src/routes/api/opds/index.ts`:

GET `/api/opds` — returns the root OPDS navigation feed.

Entries:

- "All Books" → `/api/opds/all`
- "Recently Added" → `/api/opds/recent`
- One entry per library → `/api/opds/libraries/${id}`

Authenticate first. Return 401 if not authenticated.

Response: XML with Content-Type `application/atom+xml;profile=opds-catalog;kind=navigation`

- [ ] **Step 3: Create OpenSearch descriptor**

Create `apps/web/src/routes/api/opds/search.xml.ts`:

GET `/api/opds/search.xml` — returns the OpenSearch description document.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Excalibre</ShortName>
  <Description>Search Excalibre library</Description>
  <Url type="application/atom+xml;profile=opds-catalog;kind=acquisition"
       template="{baseUrl}/api/opds/search?q={searchTerms}"/>
</OpenSearchDescription>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/server/opds.ts apps/web/src/routes/api/opds/
git commit -m "feat: add OPDS root catalog and feed helpers"
```

---

### Task 4: OPDS Acquisition Feeds + Search + PSE

**Files:**

- Create: `apps/web/src/routes/api/opds/all.ts`
- Create: `apps/web/src/routes/api/opds/recent.ts`
- Create: `apps/web/src/routes/api/opds/libraries.$libraryId.ts`
- Create: `apps/web/src/routes/api/opds/search.ts`
- Create: `apps/web/src/routes/api/opds/pse.$bookId.$pageNumber.ts`

- [ ] **Step 1: Create "All Books" feed**

Create `apps/web/src/routes/api/opds/all.ts`:

GET `/api/opds/all` — acquisition feed of all books accessible to the authenticated user. Supports pagination via `?page=N` (default page size 50). Include `<link rel="next">` if more pages exist. For each book, include acquisition links for all its files and cover image links.

- [ ] **Step 2: Create "Recently Added" feed**

Create `apps/web/src/routes/api/opds/recent.ts`:

GET `/api/opds/recent` — last 50 books ordered by createdAt DESC. Same format as "All Books" but with `rel="http://opds-spec.org/sort/new"` on the self link.

- [ ] **Step 3: Create library-specific feed**

Create `apps/web/src/routes/api/opds/libraries.$libraryId.ts`:

GET `/api/opds/libraries/:libraryId` — books in a specific library. Check library access for the authenticated user. Paginated.

- [ ] **Step 4: Create search feed**

Create `apps/web/src/routes/api/opds/search.ts`:

GET `/api/opds/search?q=searchterm` — search books by title (LIKE), return as acquisition feed. Authenticate first.

- [ ] **Step 5: Create OPDS-PSE page streaming endpoint**

Create `apps/web/src/routes/api/opds/pse.$bookId.$pageNumber.ts`:

GET `/api/opds/pse/:bookId/:pageNumber` — extracts a single page image from a CBZ file.

1. Look up book and its CBZ file
2. Open the CBZ with adm-zip
3. Get sorted image entries
4. Extract the image at the given page index (0-based)
5. Optionally resize if `?maxWidth=N` is provided (skip resizing for now — return original)
6. Return image with appropriate Content-Type

- [ ] **Step 6: Update OPDS book entries for PSE**

In the `opdsBookEntry` helper, for CBZ files, add the PSE streaming link:

```xml
<link rel="http://vaemendis.net/opds-pse/stream"
      href="/api/opds/pse/{bookId}/{pageNumber}"
      type="image/jpeg"
      pse:count="N"/>
```

Where N is the number of images in the CBZ.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/api/opds/
git commit -m "feat: add OPDS acquisition feeds, search, and page streaming"
```

---

### Task 5: Kobo Sync Helpers + Core Endpoints

**Files:**

- Create: `apps/web/src/server/kobo.ts`
- Create: `apps/web/src/routes/api/kobo/$token/v1/initialization.ts`
- Create: `apps/web/src/routes/api/kobo/$token/v1/library.sync.ts`
- Create: `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.state.ts`
- Create: `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.download.ts`

- [ ] **Step 1: Create Kobo sync helpers**

Create `apps/web/src/server/kobo.ts`:

Helper functions:

- `authenticateKobo(token: string): Promise<{userId: string} | null>` — looks up koboTokens table by token, returns the associated userId
- `buildSyncToken(state: SyncState): string` — Base64-encodes a JSON sync state object
- `parseSyncToken(token: string): SyncState` — decodes a sync token
- `buildBookMetadata(book, files, authors, baseUrl, token)` — constructs the Kobo BookMetadata JSON object
- `buildReadingState(progress)` — constructs the Kobo ReadingState JSON object
- `buildNewEntitlement(book, files, authors, progress, baseUrl, token)` — full NewEntitlement object

SyncState type:

```typescript
type SyncState = {
  booksLastModified: string; // ISO timestamp
  readingStateLastModified: string;
};
```

- [ ] **Step 2: Create initialization endpoint**

Create `apps/web/src/routes/api/kobo/$token/v1/initialization.ts`:

GET — returns the Resources object that tells the Kobo device where to find API endpoints. Override image URLs to point to our server's cover endpoint.

- [ ] **Step 3: Create library sync endpoint**

Create `apps/web/src/routes/api/kobo/$token/v1/library.sync.ts`:

GET — the main sync endpoint. Reads `x-kobo-synctoken` header, determines what's changed since last sync, returns array of NewEntitlement/ChangedEntitlement/ChangedReadingState objects. Sets `x-kobo-synctoken` response header with updated state.

For simplicity: on first sync (no token), return all books. On subsequent syncs, return books modified after the timestamp in the token.

- [ ] **Step 4: Create reading state endpoint**

Create `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.state.ts`:

GET — returns current reading state for a book.
PUT — receives reading state update from Kobo device, saves to readingProgress with deviceType="kobo".

- [ ] **Step 5: Create book download endpoint**

Create `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.download.ts`:

GET — serves the book file (EPUB preferred) to the Kobo device. Authenticate via token, find the best EPUB file for the book, serve it.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/kobo.ts apps/web/src/routes/api/kobo/
git commit -m "feat: add Kobo device sync endpoints"
```

---

### Task 6: Sync Settings Page

**Files:**

- Create: `apps/web/src/routes/_authed/settings/sync.tsx`
- Create: `apps/web/src/server/sync-settings.ts`

- [ ] **Step 1: Create sync settings server functions**

Create `apps/web/src/server/sync-settings.ts`:

Server functions for managing sync tokens/keys:

- `getKoboTokensFn` (GET) — returns all Kobo tokens for the current user
- `createKoboTokenFn` (POST) — generates a new random token (32 hex chars) for the current user with an optional device name
- `deleteKoboTokenFn` (POST) — deletes a Kobo token
- `getOpdsKeyFn` (GET) — returns the OPDS API key for the current user (create one if none exists)
- `regenerateOpdsKeyFn` (POST) — generates a new OPDS API key

Use `crypto.randomBytes(16).toString("hex")` for token/key generation.

- [ ] **Step 2: Create sync settings page**

Create `apps/web/src/routes/_authed/settings/sync.tsx`:

A settings page (NOT admin-only — each user manages their own sync config) showing:

**KOSync section:**

- Instructions text: "Use your Excalibre email and password to connect KOReader. Set the sync server URL to: `{baseUrl}/api/kosync`"
- Show the user's email as their KOSync username

**Kobo Sync section:**

- List of Kobo tokens with device name and created date
- "Add Kobo Device" button — generates new token, shows the full sync URL: `{baseUrl}/api/kobo/{token}`
- Instructions: "On your Kobo, edit `.kobo/Kobo/Kobo eReader.conf` and set `api_endpoint` under `[OneStoreServices]` to this URL"
- Delete button per token

**OPDS section:**

- Show OPDS feed URL: `{baseUrl}/api/opds?apikey={key}`
- "Regenerate API Key" button
- Instructions: "Use this URL in any OPDS-compatible reader app (KOReader, Moon Reader, Panels, etc.)"

- [ ] **Step 3: Add sync link to sidebar settings**

Update `apps/web/src/components/layout/app-sidebar.tsx` — add a "Sync" link under settings that all users can see (not admin-only). Links to `/settings/sync`. Or simpler: the sync page doesn't need to be under `/settings/` — it could be at `/sync` or `/account/sync`. But for consistency, keep it under settings and make it accessible to all authenticated users (no admin guard in beforeLoad).

Actually, looking at the existing routes, the settings routes have admin guards. The sync page should NOT have an admin guard — it's per-user. Add a `beforeLoad` that just checks `getAuthSessionFn()` (not admin role).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/server/sync-settings.ts apps/web/src/routes/_authed/settings/sync.tsx
git commit -m "feat: add sync settings page for KOSync, Kobo, and OPDS"
```
