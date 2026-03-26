# Excalibre — Architecture Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Overall architecture for a modern, Calibre-free rewrite of Calibre Web Automated

## Overview

Excalibre is a self-hosted ebook library manager and web reader. It provides feature parity with Calibre Web Automated (CWA) without depending on Calibre, using a modern TypeScript stack. The UI/UX targets Kavita-level quality for both library management and in-browser reading.

## Sub-Project Decomposition

This is a large project decomposed into independent sub-projects, each with its own spec → plan → implementation cycle:

1. **Foundation** — Turborepo monorepo, dev tooling, TanStack Start scaffold, auth (better-auth + OIDC), base DB schema, Docker setup
2. **Library & metadata** — Book import pipeline, file scanning, metadata extraction from files, cover extraction, user-driven metadata enhancement (Hardcover/Google Books), duplicate detection
3. **Format conversion** — Calibre-free ebook conversion engine (pandoc + kepubify), EPUB fixer
4. **Web reader** — In-browser reading via foliate-js (EPUB, MOBI, AZW3, FB2, CBZ) + pdf.js (PDF), annotations, highlights, reading profiles, bookmarks
5. **Sync services** — KOSync protocol (KOReader), Kobo sync, OPDS + OPDS-PS feeds, auto-send to eReader
6. **Organization & discovery** — Smart shelves/filters, collections, reading lists, customizable dashboard, analytics
7. **Docs site** — Starlight (Astro) documentation website

## Key Decisions

| Decision                  | Choice                           | Rationale                                                                                                                  |
| ------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Deployment                | Docker-only                      | Simplest for self-hosting, single container                                                                                |
| File organization         | Agnostic scanning                | Discovers nested files in data dir without modifying structure; can share data dir with Allstarr                           |
| Generated files           | Managed directory (`/excalibre`) | Uploads, conversions, covers stored separately; never writes to shared data volume                                         |
| Multi-user model          | Library-scoped access            | Admin + User roles; admins assign users to libraries                                                                       |
| Docs framework            | Starlight (Astro)                | Best-in-class docs framework, zero-config search                                                                           |
| Web reader (ebooks)       | foliate-js                       | Natively renders EPUB, MOBI, AZW3, FB2, CBZ in-browser without conversion                                                  |
| Web reader (PDF)          | pdf.js                           | Standard, proven PDF viewer                                                                                                |
| Non-native format reading | Server-side convert to EPUB      | On-demand conversion for formats foliate-js can't handle                                                                   |
| Format conversion tool    | pandoc + kepubify                | Pandoc covers most conversions; kepubify for KEPUB specifically                                                            |
| Metadata sources          | Hardcover + Google Books         | Reuses allstarr's Hardcover integration; Google Books as fallback                                                          |
| Metadata workflow         | User-driven, opt-in              | Scanner extracts from files only; external enrichment is explicit, user picks edition/cover, nothing saved until confirmed |
| Reading progress          | Per-device with merge            | Each device tracked separately; merged view (furthest progress) computed at query time                                     |
| Audiobooks                | Deferred                         | Schema accommodates them; implementation is a future sub-project                                                           |
| Ingest pipeline           | Scheduled scanning               | Configurable interval (default 30min) + manual "Scan Now"; more reliable than filesystem watchers in Docker                |
| OPDS                      | Full OPDS + OPDS-PS              | Standard catalog + page streaming for comics/manga                                                                         |
| Auth config               | Environment variables            | OIDC config via env vars, not UI; standard for Docker apps                                                                 |
| Background processing     | SQLite job queue + Bun workers   | No Redis; single process with worker threads                                                                               |

## Tech Stack

Matches the allstarr reference project:

| Category         | Tool                                  |
| ---------------- | ------------------------------------- |
| Framework        | TanStack Start (Vite + Nitro)         |
| Routing          | TanStack Router (file-based)          |
| Data fetching    | TanStack React Query v5               |
| Database         | SQLite (bun:sqlite, WAL mode)         |
| ORM              | Drizzle ORM                           |
| Auth             | better-auth (email/password + OIDC)   |
| UI components    | shadcn/ui (new-york style, zinc base) |
| CSS              | Tailwind CSS v4                       |
| Icons            | Lucide React                          |
| Forms            | react-hook-form + Zod                 |
| Linting          | oxlint                                |
| Formatting       | Prettier                              |
| Commit linting   | commitlint (conventional)             |
| Git hooks        | Husky + lint-staged                   |
| Testing          | Vitest (unit) + Playwright (e2e)      |
| Monorepo         | Turborepo                             |
| Runtime          | Bun                                   |
| Containerization | Docker (oven/bun:1-alpine)            |

## Monorepo Structure

```
excalibre/
├── apps/
│   ├── web/                    # TanStack Start app
│   │   ├── src/
│   │   │   ├── routes/         # File-based routing
│   │   │   ├── server/         # Server functions
│   │   │   ├── db/             # Drizzle schema + migrations
│   │   │   │   └── schema/     # One file per entity
│   │   │   ├── components/
│   │   │   │   ├── ui/         # shadcn/ui primitives
│   │   │   │   ├── layout/     # App shell, sidebar, header
│   │   │   │   ├── library/    # Library browsing
│   │   │   │   ├── reader/     # Reader UI wrappers
│   │   │   │   └── shared/     # Reusable components
│   │   │   ├── lib/            # Auth, utils, validators, query keys
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── workers/        # Background job workers
│   │   │   └── styles/         # Tailwind theme + global CSS
│   │   ├── drizzle/            # Migration files
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── drizzle.config.ts
│   │   └── tsconfig.json
│   └── docs/                   # Starlight docs site
│       ├── src/content/docs/
│       ├── astro.config.mjs
│       ├── package.json
│       └── tsconfig.json
├── packages/                   # Shared packages (reserved, empty initially)
├── turbo.json
├── package.json                # Root workspace
├── tsconfig.json               # Base TS config
├── oxlint.config.ts
├── commitlint.config.ts
├── .prettierrc
├── .husky/
├── Dockerfile
├── compose.yml
├── LICENSE
└── CLAUDE.md
```

## System Architecture

Single-process monolith running in Docker with background worker threads.

### Components

**Browser (Client):**

- TanStack Router — file-based routing with SSR
- React Query — data fetching and cache
- foliate-js — EPUB/MOBI/AZW3/FB2/CBZ reader
- pdf.js — PDF reader
- shadcn/ui — component library
- better-auth client — session management

**TanStack Start Server (Nitro):**

- Server functions — all data access via `createServerFn`
- SSR — server-side rendering
- better-auth — authentication (email/password + OIDC via env vars)
- KOSync API — KOReader progress sync
- Kobo Sync API — Kobo device sync
- OPDS + OPDS-PS — catalog feeds and page streaming
- SSE — real-time UI updates for scan progress, job status

**Background Workers (Bun Threads):**

- Library Scanner — periodic directory scan, file discovery, embedded metadata extraction
- Format Converter — pandoc/kepubify via child_process (user-triggered)
- EPUB Fixer — auto-repair encoding/XML/CSS issues on new EPUBs

**Data Layer:**

- SQLite (WAL mode, foreign keys enabled) via Drizzle ORM
- Job queue table for background task coordination

### Volumes

| Mount     | Path             | Mode       | Purpose                                                                      |
| --------- | ---------------- | ---------- | ---------------------------------------------------------------------------- |
| Data      | `/app/data`      | Read-only  | Shared book library; scanned but never modified; can be shared with Allstarr |
| Excalibre | `/app/excalibre` | Read-write | SQLite DB, covers, conversions, fixed EPUBs, uploads                         |

## Database Schema

### Core Entities

**Libraries:**

- id, name, type (book \| comic \| manga) — affects metadata extraction strategy and default grid display (book covers vs. comic covers with different aspect ratios)
- cover_image
- scan_paths (JSON array — paths relative to `/app/data`, e.g., `["fiction", "comics/marvel"]`)
- scan_interval (minutes, default 30), last_scanned_at

**Books:**

- id, title, sort_title, slug
- library_id → Libraries
- description, language, publisher, publish_date
- isbn10, isbn13, page_count
- cover_path (extracted/downloaded cover in /excalibre/covers/)
- hardcover_id, google_books_id
- series_id → Series, series_index
- rating
- created_at, updated_at

**BookFiles:**

- id, book_id → Books
- file_path (absolute path on disk)
- format (epub, mobi, azw3, pdf, cbz, cbr, cb7, fb2, etc.)
- file_size, file_hash (size + mtime for change detection)
- md5_hash (for KOSync document matching)
- source (scanned \| uploaded \| converted)
- volume_type (data \| excalibre)
- discovered_at, modified_at

**Authors:**

- id, name, sort_name, slug, bio
- cover_path, hardcover_id

**BooksAuthors** (join):

- book_id → Books, author_id → Authors
- role (author \| editor \| translator \| illustrator)

**Series:**

- id, name, sort_name
- library_id → Libraries

**Tags:**

- id, name
- BooksTags join table

### Users & Access

**Users** (better-auth managed):

- id, name, email, image
- role (admin \| user)
- created_at, updated_at

**Sessions, Accounts, Verification** — better-auth standard tables

**LibraryAccess** (join):

- user_id → Users, library_id → Libraries
- Admins bypass — see all libraries

### Reading & Annotations

**ReadingProgress:**

- id, user_id → Users, book_id → Books
- device_type (web \| koreader \| kobo)
- device_id (unique device identifier)
- progress (0.0–1.0 normalized)
- position (format-specific: CFI for EPUB, page for PDF, etc.)
- is_finished
- updated_at

**Annotations:**

- id, user_id → Users, book_id → Books
- type (highlight \| note \| bookmark)
- position (CFI or equivalent)
- content (highlighted text)
- note (user's annotation text)
- color
- created_at, updated_at

### Organization

**Shelves** (smart + manual):

- id, name, user_id → Users
- type (smart \| manual)
- filter_rules (JSON for smart shelves)
- sort_order

**ShelvesBooks** (join, manual shelves only):

- shelf_id → Shelves, book_id → Books

**Collections:**

- id, name, user_id → Users
- cover_image
- CollectionsBooks join table (collection_id → Collections, book_id → Books)

**ReadingLists:**

- id, name, user_id → Users
- ReadingListBooks join table with sort_order

### Background Jobs

**Jobs** (SQLite-backed queue):

- id, type (scan \| convert \| epub_fix)
- status (pending \| running \| completed \| failed)
- payload (JSON), result (JSON), error
- priority, attempts, max_attempts
- scheduled_at, started_at, completed_at
- created_at

## Route Structure

### Public Routes

- `/login` — login page
- `/register` — registration (open for first user, then invite-only)
- `/api/auth/$` — better-auth catch-all
- `/api/kosync/*` — KOSync protocol endpoints
- `/api/kobo/:authToken/*` — Kobo sync endpoints
- `/opds/*` — OPDS catalog feeds

### Authenticated Routes

- `/` — Home dashboard (continue reading, recently added, shelves)
- `/libraries/:id` — Library view (book grid/list with search, filter, sort)
- `/books/:id` — Book detail (metadata, files, reading progress, actions)
- `/read/:bookId/:fileId` — Reader view (full-screen, minimal toolbar)
- `/authors/:id` — Author page
- `/series/:id` — Series page
- `/shelves/:id` — Shelf view
- `/search` — Global search

### Admin Routes

- `/settings/general` — General settings, auth status (read-only)
- `/settings/libraries` — Create/manage libraries, scan paths
- `/settings/users` — User management, library access, invites
- `/settings/scanning` — Scan intervals, manual scan trigger
- `/settings/conversion` — Conversion settings
- `/settings/sync` — KOSync + Kobo sync configuration
- `/settings/jobs` — Job queue monitor

## App Layout

**Sidebar navigation** with sections:

- **Libraries** — one entry per library the user has access to
- **Shelves** — Currently Reading, Want to Read, Recently Added, user-created smart/manual shelves
- **Collections** — user-created collections
- **Bottom** — Settings (admin only), user profile

**Main content area:**

- Header bar with page title, count, search, filter, sort, grid/list toggle
- Book grid shows cover, title, author, reading progress bar
- Book detail page shows metadata, available formats, reading progress across devices, actions (read, enhance metadata, convert, download)

**Reader view:**

- Sidebar collapses, reader goes full-width
- Top toolbar: back, book title, chapter, TOC, font settings, annotations, bookmarks, settings
- Bottom bar: page/position indicator, progress bar, percentage

## File Pipeline

### Library Scanner (Scheduled)

1. Runs on configured interval (default 30min) or manual "Scan Now"
2. Walks all `scan_paths` for the library
3. For each file with a supported extension:
   - Compute fast hash (file size + mtime)
   - Check BookFiles table: known? changed? missing?
4. **New file:** extract metadata from file (OPF, ComicInfo.xml, MOBI header, PDF info dict), extract cover image, create Book + BookFile records, compute MD5 hash (for KOSync)
5. **Changed file:** re-extract metadata + cover, update BookFile record
6. **Missing file:** mark as missing; after N consecutive missing scans, flag for user attention (don't delete — could be temporary mount issue)
7. Emit SSE event for UI updates

### Metadata Enhancement (User-Driven)

1. User opens book detail → clicks "Enhance Metadata"
2. Server searches Hardcover (primary) and Google Books (fallback)
3. User picks the correct book from results
4. If Hardcover: user picks an edition (paperback, hardcover, etc.)
5. UI shows side-by-side comparison: current value vs. proposed value, with per-field checkboxes
6. Cover image selection: keep current, use edition cover, or upload custom
7. Nothing persisted until user clicks Save

### Format Conversion (User-Triggered)

1. User requests conversion from book detail page (e.g., "Convert MOBI → EPUB")
2. Job created in queue
3. Worker executes: `pandoc input.mobi -o output.epub` (or `kepubify` for KEPUB)
4. Output saved to `/excalibre/conversions/{bookId}/`
5. New BookFile record created (source: converted, volume_type: excalibre)

### EPUB Fixer (Auto, Post-Scan)

Runs on newly discovered EPUBs:

- Fix UTF-8 encoding issues
- Repair malformed XML declarations
- Fix invalid/missing language tags
- Clean up CSS issues
- Fixed copy saved to `/excalibre/fixed/` (original in `/data` untouched)
- Reader and download endpoints prefer the fixed copy when available, falling back to the original

## Sync Services

### KOSync (KOReader)

Built-in KOSync protocol implementation:

| Endpoint                                     | Method | Purpose                                  |
| -------------------------------------------- | ------ | ---------------------------------------- |
| `/api/kosync/users/create`                   | POST   | Register (maps to Excalibre user)        |
| `/api/kosync/users/auth`                     | POST   | Authenticate (HTTP Basic Auth, RFC 7617) |
| `/api/kosync/syncs/progress`                 | PUT    | Push progress from KOReader              |
| `/api/kosync/syncs/progress?document=<hash>` | GET    | Pull latest progress                     |

- MD5 document hashes computed on scan, stored in BookFiles
- Progress stored as ReadingProgress with device_type=koreader

### Kobo Sync

Kobo API-compatible endpoints:

| Endpoint                                           | Method | Purpose               |
| -------------------------------------------------- | ------ | --------------------- |
| `/api/kobo/:authToken/v1/initialization`           | GET    | Device initialization |
| `/api/kobo/:authToken/v1/library/sync`             | GET    | Library sync          |
| `/api/kobo/:authToken/v1/library/:bookId/metadata` | GET    | Book metadata         |
| `/api/kobo/:authToken/v1/library/:bookId/download` | GET    | Book download         |
| `/api/kobo/:authToken/v1/library/:bookId/state`    | PUT    | Update reading state  |

- Per-user auth token embedded in URL
- Progress stored as ReadingProgress with device_type=kobo

### OPDS + OPDS-PS

| Endpoint                      | Purpose              |
| ----------------------------- | -------------------- |
| `/opds`                       | Root catalog         |
| `/opds/libraries/:id`         | Library feed         |
| `/opds/search?q=<query>`      | OpenSearch           |
| `/opds/shelves/:id`           | Shelf feed           |
| `/opds/new`                   | Recently added       |
| `/opds/reading`               | Currently reading    |
| `/opds/books/:id/pages`       | Page list (OPDS-PS)  |
| `/opds/books/:id/pages/:page` | Page image (OPDS-PS) |

- Auth via per-user API key in URL or HTTP Basic
- Progress icons in titles (like Kavita)

### Progress Merging

Per-device tracking with query-time merge:

- Each device (web, koreader, kobo) stores its own ReadingProgress row
- Dashboard/shelf display shows `MAX(progress)` across all devices for a given user + book
- Book detail shows per-device breakdown with timestamps

## Auth & User Management

### Configuration (Environment Variables)

```bash
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# OIDC (optional — omit to disable)
OIDC_ISSUER=https://auth.example.com
OIDC_CLIENT_ID=excalibre
OIDC_CLIENT_SECRET=secret
OIDC_SCOPES=openid,profile,email
OIDC_AUTO_CREATE_USERS=true
DEFAULT_LIBRARY_IDS=1,2
```

### First-Run Flow

1. No users exist → `/register` is open, first user becomes admin
2. After first admin → registration requires admin invite
3. OIDC users auto-provisioned as regular users (if `OIDC_AUTO_CREATE_USERS=true`)

### Access Control

- Admin role bypasses all library access checks
- Regular users see only libraries assigned to them via LibraryAccess
- Every library-scoped server function checks access via `requireLibraryAccess()`

## Docker Deployment

### Dockerfile

Multi-stage build:

1. **Builder** — `oven/bun:1-alpine`, installs deps, builds app
2. **Runtime** — `oven/bun:1-alpine`, installs pandoc + kepubify, copies build output + migrations

### compose.yml

```yaml
services:
  excalibre:
    image: excalibre:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data:ro
      - ./excalibre:/app/excalibre
    environment:
      - BETTER_AUTH_SECRET=change-me
      - BETTER_AUTH_URL=http://localhost:3000
    restart: unless-stopped
```

- `/app/data:ro` — shared book library, read-only
- `/app/excalibre` — Excalibre managed data (DB, covers, conversions, uploads)
- Single container, no external dependencies
- Entrypoint runs migrations then starts server

### Supported Architectures

- amd64 and arm64 via `oven/bun:1-alpine`
- kepubify binary selected by architecture at build time
