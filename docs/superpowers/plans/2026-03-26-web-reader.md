# Web Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-browser book reader supporting EPUB, MOBI, AZW3, FB2, CBZ (via foliate-js) and PDF (via react-pdf), with reading progress tracking, TOC navigation, reader settings, and annotations/highlights.

**Architecture:** The reader is a full-screen route (`/read/:bookId/:fileId`) that loads a book file from the server and renders it client-side. foliate-js handles most ebook formats natively using its `<foliate-view>` custom element. PDFs use react-pdf (pdfjs-dist wrapper). Reading progress is saved to the database per-device (device_type=web) via debounced server calls. Annotations and highlights are stored per-user in the annotations table.

**Tech Stack:** foliate-js (EPUB/MOBI/AZW3/FB2/CBZ), react-pdf + pdfjs-dist (PDF), TanStack Start server functions, Drizzle ORM (readingProgress + annotations tables)

**Spec:** `docs/superpowers/specs/2026-03-26-excalibre-architecture-design.md` — Web Reader section

**IMPORTANT:** Do NOT add "Co-Authored-By" lines to git commit messages.

---

## File Structure

### New files

**API:**

- `apps/web/src/routes/api/books/$fileId.ts` — Serves book files to the browser for reading

**Server functions:**

- `apps/web/src/server/reading.ts` — Reading progress + annotation CRUD server functions

**Reader components:**

- `apps/web/src/components/reader/ebook-reader.tsx` — foliate-js wrapper for EPUB/MOBI/AZW3/FB2/CBZ
- `apps/web/src/components/reader/pdf-reader.tsx` — react-pdf wrapper for PDFs
- `apps/web/src/components/reader/reader-toolbar.tsx` — Top toolbar (back, title, chapter, actions)
- `apps/web/src/components/reader/reader-progress-bar.tsx` — Bottom progress bar
- `apps/web/src/components/reader/toc-drawer.tsx` — Table of contents slide-out panel
- `apps/web/src/components/reader/reader-settings.tsx` — Font size, theme, layout settings panel
- `apps/web/src/components/reader/annotation-popover.tsx` — Popover for creating/viewing annotations on text selection

**Reader route:**

- `apps/web/src/routes/_authed/read.$bookId.$fileId.tsx` — Reader page (full-screen, no sidebar)

**Hooks:**

- `apps/web/src/hooks/use-reading-progress.ts` — Hook for debounced progress saving
- `apps/web/src/hooks/use-reader-settings.ts` — Hook for reader settings (persisted to localStorage)

### Modified files

- `apps/web/package.json` — Add foliate-js, react-pdf dependencies
- `apps/web/src/routes/_authed/books.$bookId.tsx` — Enable "Read" button, link to reader
- `apps/web/src/lib/query-keys.ts` — Add reading progress + annotation keys

---

### Task 1: Install Reader Dependencies

**Files:**

- Modify: `apps/web/package.json`

- [ ] **Step 1: Install foliate-js and react-pdf**

Run from `apps/web`:

```bash
bun add foliate-js react-pdf
```

Note: `react-pdf` bundles `pdfjs-dist` as a dependency — do NOT install `pdfjs-dist` separately.

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "feat: add foliate-js and react-pdf reader dependencies"
```

---

### Task 2: Book File Serving API Route

**Files:**

- Create: `apps/web/src/routes/api/books/$fileId.ts`

- [ ] **Step 1: Create file serving API route**

Create `apps/web/src/routes/api/books/$fileId.ts`:

This API route serves book files to the browser. It:

1. Looks up the BookFile by ID from the database
2. Reads the file from disk
3. Returns it with the correct Content-Type and Content-Disposition headers

Use the same pattern as the existing cover serving route at `apps/web/src/routes/api/covers/$bookId.ts`.

MIME type mapping:

- epub → `application/epub+zip`
- pdf → `application/pdf`
- mobi → `application/x-mobipocket-ebook`
- azw3 → `application/x-mobi8-ebook`
- cbz → `application/x-cbz`
- fb2 → `application/x-fictionbook+xml`
- Default → `application/octet-stream`

The route should use a GET handler that:

1. Parses `fileId` from URL params (the `$` segment)
2. Queries `bookFiles` table by ID
3. Checks file exists on disk (`existsSync`)
4. Reads file and returns as a `Response` with correct Content-Type
5. Sets `Cache-Control: private, max-age=3600` (files don't change often)

Reference the cover route pattern: `apps/web/src/routes/api/covers/$bookId.ts`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/routes/api/books/
git commit -m "feat: add book file serving API route"
```

---

### Task 3: Reading Progress Server Functions

**Files:**

- Create: `apps/web/src/server/reading.ts`
- Modify: `apps/web/src/lib/query-keys.ts`

- [ ] **Step 1: Create reading progress server functions**

Create `apps/web/src/server/reading.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { db } from "src/db";
import { readingProgress, annotations } from "src/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "./middleware";

// Get reading progress for a specific book + device
export const getReadingProgressFn = createServerFn({ method: "GET" })
  .validator((input: { bookId: number }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth();
    // Get all device progress for this book
    const progress = db
      .select()
      .from(readingProgress)
      .where(
        and(
          eq(readingProgress.userId, session.user.id),
          eq(readingProgress.bookId, data.bookId),
        ),
      )
      .all();
    return progress;
  });

// Save reading progress (upsert by user + book + device)
export const saveReadingProgressFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      bookId: number;
      deviceType: "web" | "koreader" | "kobo";
      deviceId?: string;
      progress: number;
      position?: string;
      isFinished?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    // Check if progress entry exists for this user + book + device
    const existing = db
      .select()
      .from(readingProgress)
      .where(
        and(
          eq(readingProgress.userId, session.user.id),
          eq(readingProgress.bookId, data.bookId),
          eq(readingProgress.deviceType, data.deviceType),
        ),
      )
      .get();

    if (existing) {
      db.update(readingProgress)
        .set({
          progress: data.progress,
          position: data.position,
          isFinished: data.isFinished ?? data.progress >= 0.99,
          updatedAt: new Date(),
        })
        .where(eq(readingProgress.id, existing.id))
        .run();
      return { ...existing, progress: data.progress, position: data.position };
    }

    return db
      .insert(readingProgress)
      .values({
        userId: session.user.id,
        bookId: data.bookId,
        deviceType: data.deviceType,
        deviceId: data.deviceId ?? "browser",
        progress: data.progress,
        position: data.position,
        isFinished: data.isFinished ?? false,
      })
      .returning()
      .get();
  });

// Get annotations for a book
export const getAnnotationsFn = createServerFn({ method: "GET" })
  .validator((input: { bookId: number }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth();
    return db
      .select()
      .from(annotations)
      .where(
        and(
          eq(annotations.userId, session.user.id),
          eq(annotations.bookId, data.bookId),
        ),
      )
      .orderBy(desc(annotations.createdAt))
      .all();
  });

// Create annotation
export const createAnnotationFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      bookId: number;
      type: "highlight" | "note" | "bookmark";
      position?: string;
      content?: string;
      note?: string;
      color?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    return db
      .insert(annotations)
      .values({
        userId: session.user.id,
        bookId: data.bookId,
        type: data.type,
        position: data.position,
        content: data.content,
        note: data.note,
        color: data.color ?? "#facc15",
      })
      .returning()
      .get();
  });

// Delete annotation
export const deleteAnnotationFn = createServerFn({ method: "POST" })
  .validator((input: { id: number }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth();
    db.delete(annotations)
      .where(
        and(
          eq(annotations.id, data.id),
          eq(annotations.userId, session.user.id),
        ),
      )
      .run();
    return { success: true };
  });
```

- [ ] **Step 2: Add query keys for reading**

Add to `apps/web/src/lib/query-keys.ts`:

```typescript
reading: {
  progress: (bookId: number) => ["reading", "progress", bookId] as const,
  annotations: (bookId: number) => ["reading", "annotations", bookId] as const,
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/reading.ts apps/web/src/lib/query-keys.ts
git commit -m "feat: add reading progress and annotation server functions"
```

---

### Task 4: Reader Settings Hook

**Files:**

- Create: `apps/web/src/hooks/use-reader-settings.ts`

- [ ] **Step 1: Create reader settings hook**

Create `apps/web/src/hooks/use-reader-settings.ts`:

A hook that manages reader settings persisted to localStorage. Settings include: font size, font family, line height, theme (light/dark/sepia), layout (paginated/scrolled), margin size.

```typescript
import { useState, useCallback } from "react";

export type ReaderTheme = "dark" | "light" | "sepia";
export type ReaderLayout = "paginated" | "scrolled";

export type ReaderSettings = {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  theme: ReaderTheme;
  layout: ReaderLayout;
  margin: number;
};

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  fontFamily: "Georgia, serif",
  lineHeight: 1.6,
  theme: "dark",
  layout: "paginated",
  margin: 48,
};

const STORAGE_KEY = "excalibre-reader-settings";

function loadSettings(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

export function useReaderSettings() {
  const [settings, setSettingsState] = useState<ReaderSettings>(loadSettings);

  const updateSettings = useCallback((updates: Partial<ReaderSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettingsState(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-reader-settings.ts
git commit -m "feat: add reader settings hook with localStorage persistence"
```

---

### Task 5: Reading Progress Hook

**Files:**

- Create: `apps/web/src/hooks/use-reading-progress.ts`

- [ ] **Step 1: Create reading progress hook**

Create `apps/web/src/hooks/use-reading-progress.ts`:

A hook that debounces reading progress saves. It:

1. Takes `bookId` as input
2. Loads initial progress via `getReadingProgressFn`
3. Provides a `saveProgress(fraction, position)` function that debounces saves (2 second delay)
4. Uses `useMutation` to call `saveReadingProgressFn`
5. Returns: `{ initialProgress, saveProgress, isSaving }`

```typescript
import { useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getReadingProgressFn,
  saveReadingProgressFn,
} from "src/server/reading";
import { queryKeys } from "src/lib/query-keys";

export function useReadingProgress(bookId: number) {
  const queryClient = useQueryClient();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const { data: progressEntries } = useQuery({
    queryKey: queryKeys.reading.progress(bookId),
    queryFn: () => getReadingProgressFn({ data: { bookId } }),
  });

  // Find the web device progress entry
  const webProgress = progressEntries?.find((p) => p.deviceType === "web");

  const mutation = useMutation({
    mutationFn: (data: { progress: number; position?: string }) =>
      saveReadingProgressFn({
        data: {
          bookId,
          deviceType: "web",
          progress: data.progress,
          position: data.position,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reading.progress(bookId),
      });
    },
  });

  const saveProgress = useCallback(
    (fraction: number, position?: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        mutation.mutate({ progress: fraction, position });
      }, 2000);
    },
    [mutation],
  );

  // Cleanup debounce timer on unmount — save immediately if pending
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return {
    initialPosition: webProgress?.position ?? undefined,
    initialProgress: webProgress?.progress ?? 0,
    saveProgress,
    isSaving: mutation.isPending,
  };
}
```

Note: The `getReadingProgressFn` call syntax may need to be `getReadingProgressFn({ bookId })` depending on how the validator is set up — check the actual server function signature.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-reading-progress.ts
git commit -m "feat: add debounced reading progress hook"
```

---

### Task 6: Ebook Reader Component (foliate-js)

**Files:**

- Create: `apps/web/src/components/reader/ebook-reader.tsx`

- [ ] **Step 1: Create foliate-js reader wrapper**

Create `apps/web/src/components/reader/ebook-reader.tsx`:

A React component that wraps foliate-js's `<foliate-view>` custom element. This is the core reader for EPUB, MOBI, AZW3, FB2, and CBZ files.

The component should:

1. Create a container div with a ref
2. On mount: dynamically import `foliate-js/view.js` (registers the `foliate-view` custom element), create the element, append to container
3. Fetch the book file from `/api/books/${fileId}` as a Blob
4. Call `view.open(blob)` to render the book
5. Apply reader settings (font, theme, layout) via `view.renderer.setAttribute()` and `view.renderer.setStyles()`
6. Listen to `relocate` events and call `onRelocate` callback with progress data
7. Listen to `draw-annotation` and `show-annotation` events
8. Expose navigation methods: `next()`, `prev()`, `goTo(target)`
9. Restore initial position on load if provided
10. Clean up on unmount: `view.close()`, remove element

Props:

```typescript
type EbookReaderProps = {
  fileId: number;
  initialPosition?: string; // CFI or fraction to restore
  settings: ReaderSettings;
  annotations?: Array<{ position: string; color: string }>;
  onRelocate: (data: {
    fraction: number;
    position: string; // CFI
    tocItem?: { label: string; href: string };
    chapterTitle?: string;
  }) => void;
  onTocAvailable: (
    toc: Array<{ label: string; href: string; subitems?: unknown[] }>,
  ) => void;
  onTextSelected?: (data: { cfi: string; text: string }) => void;
};
```

Important considerations:

- foliate-js registers custom elements globally — only import `view.js` once (use a module-level flag)
- The `foliate-view` element must be created via `document.createElement`, not JSX
- Theme application: for dark mode, use CSS `foliate-view::part(filter) { filter: invert(1) hue-rotate(180deg); }` or apply background/text colors via `setStyles`
- For sepia mode, use warm background + dark text
- Use `useImperativeHandle` + `forwardRef` to expose `next()`, `prev()`, `goTo()` to parent

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/reader/ebook-reader.tsx
git commit -m "feat: add foliate-js ebook reader component"
```

---

### Task 7: PDF Reader Component

**Files:**

- Create: `apps/web/src/components/reader/pdf-reader.tsx`

- [ ] **Step 1: Create react-pdf reader wrapper**

Create `apps/web/src/components/reader/pdf-reader.tsx`:

A React component that wraps react-pdf for PDF viewing. Renders one page at a time with next/prev navigation.

The component should:

1. Set up the pdfjs worker (use `import.meta.url` method for Vite compatibility)
2. Import `Document` and `Page` from `react-pdf` plus their CSS files
3. Load PDF from `/api/books/${fileId}`
4. Track current page number and total pages
5. Call `onRelocate` with progress (pageNumber / totalPages) on page change
6. Restore initial position (page number stored as position string)
7. Apply theme (dark background for container, invert filter for dark mode on pages)
8. Expose `next()`, `prev()`, `goToPage(n)` via forwardRef

Props (same interface as EbookReader where applicable):

```typescript
type PdfReaderProps = {
  fileId: number;
  initialPosition?: string; // Page number as string
  settings: ReaderSettings;
  onRelocate: (data: {
    fraction: number;
    position: string;
    chapterTitle?: string;
  }) => void;
  onTocAvailable: (toc: Array<{ label: string; href: string }>) => void;
};
```

Note: react-pdf's `Document` component accepts `onLoadSuccess` which provides `numPages` and optionally outline (TOC). Use the outline as TOC if available.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/reader/pdf-reader.tsx
git commit -m "feat: add PDF reader component with react-pdf"
```

---

### Task 8: Reader UI Components

**Files:**

- Create: `apps/web/src/components/reader/reader-toolbar.tsx`
- Create: `apps/web/src/components/reader/reader-progress-bar.tsx`
- Create: `apps/web/src/components/reader/toc-drawer.tsx`
- Create: `apps/web/src/components/reader/reader-settings.tsx`

- [ ] **Step 1: Create reader toolbar**

Create `apps/web/src/components/reader/reader-toolbar.tsx`:

A fixed top bar with:

- Back button (← icon, navigates to `/books/${bookId}`)
- Book title (truncated)
- Current chapter title (from relocate event, muted text)
- Action buttons: TOC toggle, Settings toggle, Annotations toggle (Bookmark icon)
- All buttons use lucide-react icons
- Semi-transparent dark background, auto-hides after 3 seconds of inactivity, shows on mouse move/tap

Props:

```typescript
type ReaderToolbarProps = {
  bookId: number;
  bookTitle: string;
  chapterTitle?: string;
  onToggleToc: () => void;
  onToggleSettings: () => void;
  onToggleAnnotations: () => void;
};
```

- [ ] **Step 2: Create progress bar**

Create `apps/web/src/components/reader/reader-progress-bar.tsx`:

A fixed bottom bar with:

- Current position text (e.g., "Page 47 of 412" for PDF, or "Chapter 3" for EPUB)
- Progress bar (thin, colored line showing fraction complete)
- Percentage text
- Same auto-hide behavior as toolbar

Props:

```typescript
type ReaderProgressBarProps = {
  fraction: number;
  positionLabel: string; // "Page 47 of 412" or "Chapter 3"
  isSaving?: boolean;
};
```

- [ ] **Step 3: Create TOC drawer**

Create `apps/web/src/components/reader/toc-drawer.tsx`:

A slide-out panel (from the left) showing the table of contents:

- Uses shadcn Sheet component
- Renders TOC as a nested list (items with subitems)
- Current chapter is highlighted
- Clicking a TOC item navigates to it (calls `onSelect` with the href)
- Supports nested items (recursive rendering)

Props:

```typescript
type TocDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toc: Array<{ label: string; href: string; subitems?: TocItem[] }>;
  currentHref?: string;
  onSelect: (href: string) => void;
};
```

- [ ] **Step 4: Create reader settings panel**

Create `apps/web/src/components/reader/reader-settings.tsx`:

A slide-out panel (from the right) or popover with reader settings:

- Font size: slider (12-32px) with current value display
- Font family: select (Georgia, Bookerly, System, Monospace)
- Line height: slider (1.2-2.4)
- Theme: 3 buttons (Dark, Light, Sepia) with visual preview
- Layout: 2 buttons (Paginated, Scrolled)
- Margin: slider (24-96px)
- Reset to defaults button

Uses shadcn Sheet, Slider (if available, otherwise use HTML range input), Select, Button.

Props:

```typescript
type ReaderSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReaderSettings;
  onUpdateSettings: (updates: Partial<ReaderSettings>) => void;
  onReset: () => void;
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/reader/
git commit -m "feat: add reader UI components (toolbar, progress, TOC, settings)"
```

---

### Task 9: Reader Route

**Files:**

- Create: `apps/web/src/routes/_authed/read.$bookId.$fileId.tsx`

- [ ] **Step 1: Create reader route**

Create `apps/web/src/routes/_authed/read.$bookId.$fileId.tsx`:

The main reader route. This is a full-screen page with no sidebar or header (it does NOT use the AppLayout wrapper — it renders directly under `_authed` without the layout).

Wait — actually `_authed` always wraps in `AppLayout`. We need the reader to bypass the layout. Two approaches:

- Create the reader route OUTSIDE `_authed` (but then we lose auth)
- Create a separate layout route like `_authed/_reader` that doesn't use AppLayout

Best approach: Create the route at `apps/web/src/routes/_authed/read.$bookId.$fileId.tsx` and conditionally hide the sidebar in the app layout when on a reader route. OR, simpler: create a separate auth-guarded layout without the sidebar.

**Simplest approach:** Add the reader route under `_authed` and have it render a full-screen overlay that covers the sidebar/header using `position: fixed; inset: 0; z-index: 50`. This way auth still works and we don't need a separate layout.

The route should:

1. Parse `bookId` and `fileId` from params
2. Load book detail via `getBookDetailFn` to get title, format
3. Determine the reader type based on file format (pdf vs ebook)
4. Initialize `useReadingProgress(bookId)` for progress tracking
5. Initialize `useReaderSettings()` for settings
6. Manage state for: TOC open/closed, settings open/closed, current chapter, progress fraction
7. Render a full-screen fixed container with:
   - The appropriate reader component (EbookReader or PdfReader)
   - ReaderToolbar (top)
   - ReaderProgressBar (bottom)
   - TocDrawer (left sheet)
   - ReaderSettings (right sheet)
8. Pass a ref to the reader component for navigation control
9. Handle `onRelocate` events: update progress fraction, chapter title, save progress (debounced)
10. Handle `onTocAvailable`: store TOC items for the drawer

The full-screen overlay:

```tsx
<div className="fixed inset-0 z-50 bg-background flex flex-col">
  <ReaderToolbar ... />
  <div className="flex-1 relative overflow-hidden">
    {format === "pdf" ? <PdfReader ... /> : <EbookReader ... />}
  </div>
  <ReaderProgressBar ... />
  <TocDrawer ... />
  <ReaderSettings ... />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/routes/_authed/read.\$bookId.\$fileId.tsx
git commit -m "feat: add reader route with format-aware rendering"
```

---

### Task 10: Wire Up Book Detail + Annotations

**Files:**

- Modify: `apps/web/src/routes/_authed/books.$bookId.tsx`
- Create: `apps/web/src/components/reader/annotation-popover.tsx`

- [ ] **Step 1: Enable Read button on book detail page**

Modify `apps/web/src/routes/_authed/books.$bookId.tsx`:

- Find the disabled "Read" button
- Enable it and make it a Link to `/read/${bookId}/${firstFileId}` where `firstFileId` is the first file in the book's file list (prefer EPUB format if multiple files exist)
- If no files exist, keep the button disabled

The link should target the best readable file:

```typescript
// Pick the best file to read: prefer epub > pdf > cbz > mobi > first available
const FORMAT_PRIORITY = ["epub", "pdf", "cbz", "mobi", "azw3", "fb2"];
const bestFile = book.files.sort((a, b) => {
  const aIdx = FORMAT_PRIORITY.indexOf(a.format);
  const bIdx = FORMAT_PRIORITY.indexOf(b.format);
  return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
})[0];
```

Also update each file row in the files table to have a "Read" link pointing to `/read/${bookId}/${file.id}`.

- [ ] **Step 2: Create annotation popover**

Create `apps/web/src/components/reader/annotation-popover.tsx`:

A popover that appears when the user selects text in the ebook reader. Shows:

- The selected text (truncated)
- Color picker: 5 color circles (yellow, green, blue, pink, orange)
- "Add Note" textarea (expandable)
- "Highlight" button — creates a highlight annotation
- "Save Note" button — creates a note annotation (if note text provided)
- Uses `createAnnotationFn` from server/reading
- Invalidates annotations query on success

This component is used by the reader route — when `onTextSelected` fires from the EbookReader, the route shows this popover near the selection.

Props:

```typescript
type AnnotationPopoverProps = {
  bookId: number;
  cfi: string;
  selectedText: string;
  position: { x: number; y: number };
  onClose: () => void;
  onCreated: () => void;
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_authed/books.\$bookId.tsx apps/web/src/components/reader/annotation-popover.tsx
git commit -m "feat: enable read button and add annotation creation"
```
