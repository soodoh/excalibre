# Format Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build user-triggered ebook format conversion (via pandoc + kepubify), an automatic EPUB fixer for newly scanned EPUBs, a job queue worker to process these tasks, and a jobs monitoring page.

**Architecture:** Conversions are user-triggered from the book detail page. The user selects a target format, which creates a job in the `jobs` table. A job worker (started alongside the scheduler) polls for pending conversion/epub_fix jobs, shells out to pandoc or kepubify via `child_process.execFile` (NOT `exec` — prevents shell injection), saves output to the Excalibre managed directory, and creates a new BookFile record. The EPUB fixer runs automatically after library scans on newly discovered EPUBs.

**Tech Stack:** Node `child_process.execFile` (pandoc, kepubify CLI — safe from shell injection), Drizzle ORM (jobs + bookFiles tables), adm-zip (EPUB fixer), existing scanner integration

**Spec:** `docs/superpowers/specs/2026-03-26-excalibre-architecture-design.md` — Format Conversion section

**IMPORTANT:** Do NOT add "Co-Authored-By" lines to git commit messages.

**SECURITY NOTE:** Always use `execFile` (not `exec`) for running CLI tools. `execFile` does not invoke a shell, preventing command injection. Never interpolate user input into shell command strings.

---

## File Structure

### New files

- `apps/web/src/server/converter.ts` — Format conversion logic (pandoc/kepubify via execFile)
- `apps/web/src/server/epub-fixer.ts` — EPUB repair logic
- `apps/web/src/server/job-worker.ts` — Job queue worker (polls jobs table, dispatches to converter/fixer)
- `apps/web/src/server/conversion.ts` — Server functions for triggering conversions and querying job status
- `apps/web/src/components/library/convert-dialog.tsx` — "Convert to..." dialog on book detail page

### Modified files

- `apps/web/src/server/scheduler.ts` — Start job worker alongside scan scheduler
- `apps/web/src/server/scanner.ts` — Queue epub_fix jobs for newly discovered EPUBs
- `apps/web/src/routes/_authed/books.$bookId.tsx` — Add "Convert" button
- `apps/web/src/routes/_authed/settings/jobs.tsx` — Replace stub with job queue monitor

---

### Task 1: Converter Module

**Files:**

- Create: `apps/web/src/server/converter.ts`

- [ ] **Step 1: Create the converter module**

Create `apps/web/src/server/converter.ts`:

Wraps pandoc and kepubify CLI tools for format conversion. Uses `execFile` (NOT `exec`) to prevent shell injection.

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { db } from "src/db";
import { bookFiles, books } from "src/db/schema";
import { eq } from "drizzle-orm";

const execFileAsync = promisify(execFile);
const EXCALIBRE_DIR = process.env.EXCALIBRE_DIR ?? "data/excalibre";
```

Functions:

- `convertWithPandoc(inputPath: string, outputPath: string): Promise<void>` — calls `execFile("pandoc", [inputPath, "-o", outputPath])`. Throws on non-zero exit.

- `convertWithKepubify(inputPath: string, outputDir: string): Promise<string>` — calls `execFile("kepubify", ["-o", outputDir, inputPath])`. Returns the output file path.

- `convertBook(bookFileId: number, targetFormat: string): Promise<BookFileRecord>` — the main function:
  1. Look up BookFile by ID
  2. Look up the parent Book for title
  3. Create output directory: `${EXCALIBRE_DIR}/conversions/${bookId}/`
  4. Determine output path: `${outputDir}/${sanitizedTitle}.${targetFormat}`
  5. If targetFormat is "kepub": use kepubify (input must be epub)
  6. Otherwise: use pandoc
  7. Get output file stats, compute MD5
  8. Insert new BookFile record (source="converted", volumeType="excalibre")
  9. Return the new record

- `getSupportedConversions(sourceFormat: string): string[]` — returns available targets:
  - epub → ["pdf", "mobi", "docx", "html", "txt", "kepub"]
  - mobi → ["epub", "pdf", "html", "txt"]
  - azw3 → ["epub", "pdf", "html"]
  - pdf → ["epub", "html", "txt"]
  - docx → ["epub", "pdf", "html"]
  - html → ["epub", "pdf", "docx"]
  - Default → ["epub", "pdf"]

Sanitize the book title for filenames: replace non-alphanumeric chars (except spaces, hyphens, underscores) with empty string, trim.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/server/converter.ts
git commit -m "feat: add format conversion module (pandoc + kepubify)"
```

---

### Task 2: EPUB Fixer Module

**Files:**

- Create: `apps/web/src/server/epub-fixer.ts`

- [ ] **Step 1: Create the EPUB fixer module**

Create `apps/web/src/server/epub-fixer.ts`:

Opens an EPUB (ZIP), applies safe fixes to common issues, saves a fixed copy.

```typescript
import AdmZip from "adm-zip";
import { mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { db } from "src/db";
import { bookFiles, books } from "src/db/schema";
import { eq } from "drizzle-orm";

const EXCALIBRE_DIR = process.env.EXCALIBRE_DIR ?? "data/excalibre";
```

Function: `fixEpub(bookFileId: number): Promise<void>`:

1. Look up BookFile by ID, verify it's an EPUB
2. Open with `new AdmZip(filePath)`
3. For each entry ending in `.xhtml`, `.html`, or `.htm`:
   a. Get entry data as UTF-8 string
   b. Strip null bytes (`\x00`)
   c. Ensure XML declaration exists at the start — if missing, prepend `<?xml version="1.0" encoding="UTF-8"?>`
   d. Ensure `<html>` tag has `xml:lang` attribute — if missing, add `xml:lang="en"`
   e. Update the entry data if any changes were made
4. Track whether any changes were made
5. If changes: save fixed EPUB to `${EXCALIBRE_DIR}/fixed/${bookId}/${filename}` and create a new BookFile record with source="converted", volumeType="excalibre"
6. If no changes needed: do nothing (no unnecessary copies)

Keep fixes minimal — only fix what commonly breaks readers. Don't try to validate full EPUB compliance.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/server/epub-fixer.ts
git commit -m "feat: add EPUB fixer module for auto-repair"
```

---

### Task 3: Job Queue Worker + Scanner Integration

**Files:**

- Create: `apps/web/src/server/job-worker.ts`
- Modify: `apps/web/src/server/scheduler.ts`
- Modify: `apps/web/src/server/scanner.ts`

- [ ] **Step 1: Create the job worker**

Create `apps/web/src/server/job-worker.ts`:

Polls the `jobs` table for pending jobs, dispatches to the appropriate handler.

```typescript
import { db } from "src/db";
import { jobs } from "src/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { convertBook } from "./converter";
import { fixEpub } from "./epub-fixer";

const POLL_INTERVAL = 5_000;
let workerStarted = false;

async function processNextJob(): Promise<boolean> {
  // Find oldest pending job where attempts < maxAttempts
  const job = db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "pending"))
    .orderBy(asc(jobs.priority), asc(jobs.createdAt))
    .limit(1)
    .get();

  if (!job || job.attempts >= job.maxAttempts) return false;

  // Mark running
  db.update(jobs)
    .set({
      status: "running",
      startedAt: new Date(),
      attempts: job.attempts + 1,
    })
    .where(eq(jobs.id, job.id))
    .run();

  try {
    let result: Record<string, unknown>;
    const payload = job.payload as Record<string, unknown>;

    switch (job.type) {
      case "convert": {
        const newFile = await convertBook(
          payload.bookFileId as number,
          payload.targetFormat as string,
        );
        result = { newFileId: newFile.id, format: payload.targetFormat };
        break;
      }
      case "epub_fix": {
        await fixEpub(payload.bookFileId as number);
        result = { fixed: true };
        break;
      }
      default:
        result = { skipped: true };
    }

    db.update(jobs)
      .set({ status: "completed", result, completedAt: new Date() })
      .where(eq(jobs.id, job.id))
      .run();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isFinalAttempt = job.attempts + 1 >= job.maxAttempts;
    db.update(jobs)
      .set({ status: isFinalAttempt ? "failed" : "pending", error: errorMsg })
      .where(eq(jobs.id, job.id))
      .run();
  }

  return true;
}

async function workerLoop(): Promise<void> {
  try {
    const hadWork = await processNextJob();
    setTimeout(
      () => {
        void workerLoop();
      },
      hadWork ? 100 : POLL_INTERVAL,
    );
  } catch (err) {
    console.error("[job-worker] Error:", err);
    setTimeout(() => {
      void workerLoop();
    }, POLL_INTERVAL);
  }
}

export function ensureJobWorkerStarted(): void {
  if (workerStarted) return;
  workerStarted = true;
  console.log("[job-worker] Starting job queue worker");
  setTimeout(() => {
    void workerLoop();
  }, 2_000);
}
```

- [ ] **Step 2: Wire job worker into scheduler**

Modify `apps/web/src/server/scheduler.ts`:

Import `ensureJobWorkerStarted` from `./job-worker` and call it inside `ensureSchedulerStarted()`:

```typescript
export function ensureSchedulerStarted(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  // ... existing scan scheduler code ...

  // Start the job worker
  const { ensureJobWorkerStarted } = await import("./job-worker");
  ensureJobWorkerStarted();
}
```

Note: since `ensureSchedulerStarted` is not async, use a dynamic import pattern or just import at the top level. Check the existing code pattern and match it.

- [ ] **Step 3: Queue epub_fix jobs from scanner**

Modify `apps/web/src/server/scanner.ts`:

After creating a new BookFile record for a file with format "epub", insert an epub_fix job:

```typescript
// After the bookFile insert, if format is epub:
if (format === "epub") {
  db.insert(jobs)
    .values({
      type: "epub_fix",
      payload: { bookFileId: newBookFileRecord.id },
      priority: 1,
    })
    .run();
}
```

Import `jobs` from the schema if not already imported.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/server/job-worker.ts apps/web/src/server/scheduler.ts apps/web/src/server/scanner.ts
git commit -m "feat: add job queue worker for conversion and EPUB fixing"
```

---

### Task 4: Conversion Server Functions + Book Detail UI

**Files:**

- Create: `apps/web/src/server/conversion.ts`
- Create: `apps/web/src/components/library/convert-dialog.tsx`
- Modify: `apps/web/src/routes/_authed/books.$bookId.tsx`

- [ ] **Step 1: Create conversion server functions**

Create `apps/web/src/server/conversion.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { db } from "src/db";
import { jobs, bookFiles } from "src/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./middleware";
import { getSupportedConversions } from "./converter";
```

Server functions:

- `requestConversionFn` (POST) — validates `{ bookFileId: number, targetFormat: string }`, verifies the file exists and target format is valid, creates a job with type="convert", returns the job record. Requires auth (any user).

- `getSupportedConversionsFn` (GET) — takes `{ format: string }`, returns `getSupportedConversions(format)`. No auth needed (used for UI).

- `getJobsForBookFn` (GET) — takes `{ bookId: number }`, queries jobs where payload.bookFileId is in the bookFiles for this bookId. Returns recent jobs. Requires auth.

- `getRecentJobsFn` (GET) — admin only, returns last 50 jobs ordered by createdAt DESC.

- [ ] **Step 2: Create convert dialog**

Create `apps/web/src/components/library/convert-dialog.tsx`:

A dialog showing:

- Source file info: format badge, file size
- Target format select (populated from `getSupportedConversionsFn`)
- "Convert" button that calls `requestConversionFn`
- Toast: "Conversion queued!"
- Invalidates book detail query on success

Props: `bookFile: { id, format, fileSize }, bookId: number, trigger: ReactNode`

Uses shadcn Dialog, Select, Button. Uses useMutation + useQuery.

- [ ] **Step 3: Add Convert button to book detail page**

Modify `apps/web/src/routes/_authed/books.$bookId.tsx`:

In the action buttons area (after the Read button and Add to... button), add:

```tsx
<ConvertDialog
  bookFile={bestFile}
  bookId={book.id}
  trigger={
    <Button variant="outline">
      <ArrowRightLeft className="mr-2 h-4 w-4" />
      Convert
    </Button>
  }
/>
```

Import `ConvertDialog` from `src/components/library/convert-dialog` and `ArrowRightLeft` from `lucide-react`.

Also add a Convert button per file row in the files table.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/server/conversion.ts apps/web/src/components/library/convert-dialog.tsx apps/web/src/routes/_authed/books.\$bookId.tsx
git commit -m "feat: add format conversion UI and server functions"
```

---

### Task 5: Jobs Monitoring Page

**Files:**

- Modify: `apps/web/src/routes/_authed/settings/jobs.tsx`

- [ ] **Step 1: Replace jobs page stub with monitoring UI**

Replace `apps/web/src/routes/_authed/settings/jobs.tsx`:

Full job queue monitoring page:

- `useQuery` with `getRecentJobsFn` and `queryKeys.jobs.list()`
- `refetchInterval: 5000` for auto-refresh
- Table columns:
  - Type: badge (scan/convert/epub_fix) with colors
  - Status: badge (pending=gray, running=blue, completed=green, failed=red)
  - Details: summary from payload (e.g., "Convert MOBI → EPUB", "Fix EPUB #123")
  - Created: relative timestamp
  - Duration: if completed, show elapsed time
  - Error: if failed, show truncated error with full text in tooltip
- Empty state: "No jobs in queue"
- Keep admin `beforeLoad` guard

Use shadcn Badge for type/status, Tooltip for error messages.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/routes/_authed/settings/jobs.tsx
git commit -m "feat: add job queue monitoring page"
```
