# Organization & Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build shelves (smart + manual), collections, reading lists, global search, and a "Continue Reading" dashboard section — giving users full control over organizing and discovering their library.

**Architecture:** Shelves can be manual (user picks books) or smart (dynamic, rule-based — books match automatically). Collections are manual groupings. Reading lists are ordered sequences. All are per-user. Smart shelves use a JSON filter rules format evaluated at query time via Drizzle's query builder. Global search queries books, authors, and series across accessible libraries.

**Tech Stack:** Drizzle ORM (existing schema: shelves, shelvesBooks, collections, collectionsBooks, readingLists, readingListBooks, readingProgress), TanStack Start server functions, React Query, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-26-excalibre-architecture-design.md` — Organization section

**IMPORTANT:** Do NOT add "Co-Authored-By" lines to git commit messages.

---

## File Structure

### New files

**Server functions:**

- `apps/web/src/server/shelves.ts` — Shelf CRUD + smart filter evaluation + book management
- `apps/web/src/server/collections.ts` — Collection CRUD + book management
- `apps/web/src/server/reading-lists.ts` — Reading list CRUD + ordered book management
- `apps/web/src/server/search.ts` — Global search across books, authors, series

**Routes:**

- `apps/web/src/routes/_authed/shelves.$shelfId.tsx` — Shelf browse page
- `apps/web/src/routes/_authed/collections.$collectionId.tsx` — Collection browse page
- `apps/web/src/routes/_authed/reading-lists.$listId.tsx` — Reading list browse page
- `apps/web/src/routes/_authed/search.tsx` — Global search page

**Components:**

- `apps/web/src/components/organization/shelf-form.tsx` — Create/edit shelf dialog
- `apps/web/src/components/organization/collection-form.tsx` — Create/edit collection dialog
- `apps/web/src/components/organization/reading-list-form.tsx` — Create/edit reading list dialog
- `apps/web/src/components/organization/add-to-shelf.tsx` — Popover to add a book to shelves/collections/lists
- `apps/web/src/components/organization/smart-filter-builder.tsx` — Smart shelf rule editor

### Modified files

- `apps/web/src/components/layout/app-sidebar.tsx` — Add Shelves and Collections sections
- `apps/web/src/routes/_authed/index.tsx` — Replace "Coming soon" with real Continue Reading
- `apps/web/src/routes/_authed/books.$bookId.tsx` — Add "Add to..." button for shelves/collections/lists
- `apps/web/src/lib/query-keys.ts` — Add search + reading list keys
- `apps/web/src/lib/validators.ts` — Add shelf/collection/reading list validators

---

### Task 1: Validators + Shelf Server Functions

**Files:**

- Modify: `apps/web/src/lib/validators.ts`
- Create: `apps/web/src/server/shelves.ts`

- [ ] **Step 1: Add organization validators**

Add to `apps/web/src/lib/validators.ts`:

```typescript
export const createShelfSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["smart", "manual"]),
  filterRules: z.record(z.unknown()).optional(),
});

export const createCollectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const createReadingListSchema = z.object({
  name: z.string().min(1, "Name is required"),
});
```

- [ ] **Step 2: Create shelf server functions**

Create `apps/web/src/server/shelves.ts`:

Server functions:

- `getShelvesFn` (GET) — returns all shelves for the authenticated user, ordered by sortOrder
- `getShelfBooksFn` (GET) — takes `{ shelfId }`:
  - For manual shelves: joins `shelvesBooks` → `books`, returns the books
  - For smart shelves: evaluates `filterRules` against the `books` table using Drizzle conditions, returns matching books
- `createShelfFn` (POST) — creates a shelf for the current user
- `updateShelfFn` (POST) — updates a shelf (name, filterRules, sortOrder)
- `deleteShelfFn` (POST) — deletes a shelf
- `addBookToShelfFn` (POST) — adds a book to a manual shelf (inserts into shelvesBooks)
- `removeBookFromShelfFn` (POST) — removes a book from a manual shelf

**Smart filter evaluation:**

The `filterRules` JSON has this structure:

```typescript
type FilterRules = {
  operator: "and" | "or";
  conditions: Array<{
    field:
      | "title"
      | "author"
      | "language"
      | "publisher"
      | "tag"
      | "series"
      | "rating"
      | "hasProgress"
      | "isFinished";
    op:
      | "contains"
      | "equals"
      | "startsWith"
      | "greaterThan"
      | "lessThan"
      | "exists";
    value: string | number | boolean;
  }>;
};
```

The `evaluateSmartFilter` function builds Drizzle `where` conditions:

- `title contains "sci-fi"` → `like(books.title, '%sci-fi%')`
- `language equals "en"` → `eq(books.language, 'en')`
- `rating greaterThan 4` → `gt(books.rating, 4)`
- `tag contains "fantasy"` → subquery on booksTags
- `author contains "Herbert"` → subquery on booksAuthors → authors
- `hasProgress exists true` → subquery on readingProgress for current user
- `isFinished equals true` → subquery on readingProgress where isFinished=true

For the `and` operator, use `and(...conditions)`. For `or`, use `or(...conditions)`.

The function should also filter by accessible libraries (same pattern as `getRecentBooksFn` in books.ts).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/validators.ts apps/web/src/server/shelves.ts
git commit -m "feat: add shelf CRUD and smart filter server functions"
```

---

### Task 2: Collection + Reading List Server Functions

**Files:**

- Create: `apps/web/src/server/collections.ts`
- Create: `apps/web/src/server/reading-lists.ts`

- [ ] **Step 1: Create collection server functions**

Create `apps/web/src/server/collections.ts`:

- `getCollectionsFn` (GET) — returns all collections for the user with book count (use a subquery or separate count query)
- `getCollectionBooksFn` (GET) — takes `{ collectionId }`, returns books in the collection via collectionsBooks join
- `createCollectionFn` (POST) — creates a collection
- `updateCollectionFn` (POST) — updates name/coverImage
- `deleteCollectionFn` (POST) — deletes a collection
- `addBookToCollectionFn` (POST) — adds a book to a collection
- `removeBookFromCollectionFn` (POST) — removes a book from a collection

- [ ] **Step 2: Create reading list server functions**

Create `apps/web/src/server/reading-lists.ts`:

- `getReadingListsFn` (GET) — returns all reading lists for the user with book count
- `getReadingListBooksFn` (GET) — takes `{ readingListId }`, returns books ordered by sortOrder
- `createReadingListFn` (POST) — creates a reading list
- `updateReadingListFn` (POST) — updates name
- `deleteReadingListFn` (POST) — deletes a reading list
- `addBookToReadingListFn` (POST) — adds a book to the end of the list (sortOrder = max + 1)
- `removeBookFromReadingListFn` (POST) — removes a book
- `reorderReadingListFn` (POST) — takes `{ readingListId, bookIds: number[] }` — updates sortOrder for all books based on array position

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/collections.ts apps/web/src/server/reading-lists.ts
git commit -m "feat: add collection and reading list server functions"
```

---

### Task 3: Search + Continue Reading Server Functions

**Files:**

- Create: `apps/web/src/server/search.ts`
- Modify: `apps/web/src/lib/query-keys.ts`

- [ ] **Step 1: Create search server function**

Create `apps/web/src/server/search.ts`:

- `searchFn` (GET) — takes `{ query: string, limit?: number }`:
  1. Search books by title (LIKE)
  2. Search authors by name (LIKE)
  3. Search series by name (LIKE)
  4. All filtered by accessible libraries (same pattern as getRecentBooksFn)
  5. Returns `{ books: [...], authors: [...], series: [...] }` — each array has id, name/title, and relevant metadata

- `getContinueReadingFn` (GET) — takes `{ limit?: number }`:
  1. Query `readingProgress` for the current user where `isFinished = false` and `progress > 0`
  2. Join with `books` to get book details
  3. Order by `readingProgress.updatedAt DESC` (most recently read first)
  4. Return books with their progress fraction
  5. Filter by accessible libraries

- [ ] **Step 2: Update query keys**

Add to `apps/web/src/lib/query-keys.ts`:

```typescript
search: {
  results: (query: string) => ["search", "results", query] as const,
},
readingLists: {
  all: ["readingLists"] as const,
  detail: (id: number) => ["readingLists", "detail", id] as const,
  books: (id: number) => ["readingLists", "books", id] as const,
},
continueReading: {
  list: () => ["continueReading", "list"] as const,
},
```

Also add to the existing `shelves` and `collections` entries:

```typescript
shelves: {
  all: ["shelves"] as const,
  list: () => ["shelves", "list"] as const,
  detail: (id: number) => ["shelves", "detail", id] as const,
  books: (id: number) => ["shelves", "books", id] as const,
},
collections: {
  all: ["collections"] as const,
  list: () => ["collections", "list"] as const,
  detail: (id: number) => ["collections", "detail", id] as const,
  books: (id: number) => ["collections", "books", id] as const,
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/search.ts apps/web/src/lib/query-keys.ts
git commit -m "feat: add search and continue reading server functions"
```

---

### Task 4: Sidebar — Shelves + Collections

**Files:**

- Modify: `apps/web/src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Add shelves and collections to sidebar**

Update `apps/web/src/components/layout/app-sidebar.tsx`:

After the Libraries section and before the Admin section, add two new sections:

**Shelves section:**

- `useQuery` with `getShelvesFn` and `queryKeys.shelves.list()`
- Show each shelf as a `SidebarMenuItem` linking to `/shelves/${shelf.id}`
- Use `Bookmark` icon (lucide-react) for manual shelves, `Sparkles` icon for smart shelves
- Add a "+" button next to the section label that opens the shelf form dialog (Task 6)
- Show "No shelves yet" placeholder when empty

**Collections section:**

- `useQuery` with `getCollectionsFn` and `queryKeys.collections.list()`
- Show each collection as a `SidebarMenuItem` linking to `/collections/${collection.id}`
- Use `FolderOpen` icon (lucide-react)
- Add a "+" button next to the section label
- Show "No collections yet" placeholder when empty

Import `getShelvesFn` from `src/server/shelves` and `getCollectionsFn` from `src/server/collections`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/app-sidebar.tsx
git commit -m "feat: add shelves and collections to sidebar"
```

---

### Task 5: Organization Form Components

**Files:**

- Create: `apps/web/src/components/organization/shelf-form.tsx`
- Create: `apps/web/src/components/organization/smart-filter-builder.tsx`
- Create: `apps/web/src/components/organization/collection-form.tsx`
- Create: `apps/web/src/components/organization/reading-list-form.tsx`
- Create: `apps/web/src/components/organization/add-to-shelf.tsx`

- [ ] **Step 1: Create smart filter builder**

Create `apps/web/src/components/organization/smart-filter-builder.tsx`:

A form component for building smart shelf filter rules. Shows:

- Operator toggle: AND / OR (two buttons)
- List of conditions, each with:
  - Field select: Title, Author, Language, Publisher, Tag, Series, Rating, Has Progress, Is Finished
  - Operation select (changes based on field type):
    - String fields: contains, equals, startsWith
    - Number fields (rating): greaterThan, lessThan, equals
    - Boolean fields (hasProgress, isFinished): exists, equals
  - Value input: text input for strings, number input for numbers, checkbox for booleans
  - Remove button (X)
- "Add Condition" button

Props:

```typescript
type FilterRules = {
  operator: "and" | "or";
  conditions: Array<{
    field: string;
    op: string;
    value: string | number | boolean;
  }>;
};

type SmartFilterBuilderProps = {
  value: FilterRules;
  onChange: (rules: FilterRules) => void;
};
```

- [ ] **Step 2: Create shelf form dialog**

Create `apps/web/src/components/organization/shelf-form.tsx`:

A dialog for creating/editing shelves:

- Name input
- Type select: Manual / Smart
- When Smart is selected, show the `SmartFilterBuilder` component
- Uses react-hook-form with zodResolver
- On submit: calls `createShelfFn` or `updateShelfFn`
- Invalidates `queryKeys.shelves.all` on success
- Props: `shelf?` for edit mode, `trigger` for the dialog trigger element

- [ ] **Step 3: Create collection form dialog**

Create `apps/web/src/components/organization/collection-form.tsx`:

Similar to shelf form but simpler — just a name field. Uses `createCollectionFn`/`updateCollectionFn`.

- [ ] **Step 4: Create reading list form dialog**

Create `apps/web/src/components/organization/reading-list-form.tsx`:

Same pattern as collection form. Uses `createReadingListFn`/`updateReadingListFn`.

- [ ] **Step 5: Create "Add to..." popover**

Create `apps/web/src/components/organization/add-to-shelf.tsx`:

A dropdown menu that appears when clicking "Add to..." on a book detail page:

- Sections: Shelves (manual only), Collections, Reading Lists
- Each shows a list of the user's items with a checkbox/toggle to add/remove the book
- Uses `getShelvesFn`, `getCollectionsFn`, `getReadingListsFn` to load options
- Uses the add/remove server functions on toggle
- Shows toast on success

Props: `bookId: number, trigger: React.ReactNode`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/organization/
git commit -m "feat: add organization form components and smart filter builder"
```

---

### Task 6: Shelf Browse Page

**Files:**

- Create: `apps/web/src/routes/_authed/shelves.$shelfId.tsx`

- [ ] **Step 1: Create shelf browse page**

The page:

- Parses `shelfId` from params
- Fetches shelf via query (can reuse a server function or create one)
- Fetches books via `getShelfBooksFn`
- Shows shelf name (h1), type badge (Smart/Manual), book count
- For manual shelves: shows a "Manage Books" option or allows removing books
- Shows books in a `BookGrid`
- Edit button opens `ShelfForm` in edit mode
- Delete button with confirmation
- Back button

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/routes/_authed/shelves.\$shelfId.tsx
git commit -m "feat: add shelf browse page"
```

---

### Task 7: Collection + Reading List Browse Pages

**Files:**

- Create: `apps/web/src/routes/_authed/collections.$collectionId.tsx`
- Create: `apps/web/src/routes/_authed/reading-lists.$listId.tsx`

- [ ] **Step 1: Create collection browse page**

Similar to shelf page:

- Collection name, book count
- Books in a `BookGrid`
- Remove books from collection
- Edit/delete collection
- Back button

- [ ] **Step 2: Create reading list browse page**

Shows books in an ordered list (not grid — order matters):

- Numbered list with book title, author, cover thumbnail
- Drag-and-drop reordering (or up/down buttons)
- Remove books from list
- Edit/delete list
- Back button

For drag-and-drop, keep it simple — use up/down arrow buttons that call `reorderReadingListFn`. Full DnD can be added later.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_authed/collections.\$collectionId.tsx apps/web/src/routes/_authed/reading-lists.\$listId.tsx
git commit -m "feat: add collection and reading list browse pages"
```

---

### Task 8: Global Search Page

**Files:**

- Create: `apps/web/src/routes/_authed/search.tsx`

- [ ] **Step 1: Create search page**

The search page:

- URL-driven query: `/search?q=searchterm` (use search params)
- Large search input at the top (auto-focused)
- Debounced search (300ms) via React state + `useQuery` with `searchFn`
- Results sections:
  - **Books** — shows matching books in a `BookGrid` (or compact list)
  - **Authors** — shows matching authors as links
  - **Series** — shows matching series as links
- Each section shows count and "See all" if truncated
- Empty state when no results
- Loading skeleton while searching

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/routes/_authed/search.tsx
git commit -m "feat: add global search page"
```

---

### Task 9: Dashboard Update + Book Detail "Add to..."

**Files:**

- Modify: `apps/web/src/routes/_authed/index.tsx`
- Modify: `apps/web/src/routes/_authed/books.$bookId.tsx`

- [ ] **Step 1: Update home page with Continue Reading**

Replace the "Coming soon..." section in `apps/web/src/routes/_authed/index.tsx`:

- Use `useQuery` with `getContinueReadingFn({ limit: 6 })` and `queryKeys.continueReading.list()`
- Show books with their reading progress as a grid of cards
- Each card shows: cover, title, progress bar with percentage
- If no in-progress books, show "Start reading a book to see it here" in muted text

- [ ] **Step 2: Add "Add to..." button on book detail**

Update `apps/web/src/routes/_authed/books.$bookId.tsx`:

- Import the `AddToShelf` component from `src/components/organization/add-to-shelf`
- Add an "Add to..." button near the other action buttons
- Use `AddToShelf` with `bookId={book.id}` and a Button as trigger

- [ ] **Step 3: Add search link to header**

Update `apps/web/src/components/layout/header.tsx`:

- Add a search icon button (Search from lucide-react) that links to `/search`
- Or add a search input in the header that navigates to `/search?q=query` on submit

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_authed/index.tsx apps/web/src/routes/_authed/books.\$bookId.tsx apps/web/src/components/layout/header.tsx
git commit -m "feat: add continue reading, book organization, and search"
```
