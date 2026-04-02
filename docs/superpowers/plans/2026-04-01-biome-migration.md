# Biome Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace oxlint and prettier with Biome for unified linting and formatting.

**Architecture:** Single `biome.json` config at repo root. Biome handles both linting and formatting. All existing code is reformatted and refactored to comply with Biome's recommended rules — no suppressions.

**Tech Stack:** Biome 2.x, Bun, Lefthook, Turborepo

**Spec:** `docs/superpowers/specs/2026-04-01-oxlint-prettier-to-biome-migration.md`

---

### Task 1: Swap dependencies and config files

**Files:**

- Create: `biome.json`
- Delete: `oxlint.config.ts`, `.prettierrc`, `.prettierignore`
- Modify: `package.json`

- [ ] **Step 1: Add biome and remove old dependencies**

```bash
bun remove oxlint @standard-config/oxlint oxlint-tsgolint prettier
bun add -d @biomejs/biome
```

- [ ] **Step 2: Create `biome.json` at repo root**

Write this exact content to `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.10/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "ignoreUnknown": true,
    "includes": [
      "**",
      "!!**/node_modules",
      "!!**/.output",
      "!!**/dist",
      "!!**/src/routeTree.gen.ts"
    ]
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "css": {
    "parser": {
      "tailwindDirectives": true
    }
  },
  "formatter": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noRestrictedImports": {
          "level": "error",
          "options": {
            "paths": {
              "react": {
                "importNames": ["default"],
                "message": "Use named imports from 'react' instead."
              }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Delete old config files**

```bash
rm oxlint.config.ts .prettierrc .prettierignore
```

- [ ] **Step 4: Verify biome runs**

```bash
bunx biome check . --max-diagnostics=10
```

Expected: Biome runs and reports violations (formatting + lint). This confirms the config is valid.

- [ ] **Step 5: Commit**

```bash
git add biome.json package.json bun.lock
git add -u oxlint.config.ts .prettierrc .prettierignore
git commit -m "feat: replace oxlint and prettier with biome"
```

---

### Task 2: Update lint scripts and lefthook

**Files:**

- Modify: `apps/web/package.json`
- Modify: `lefthook.yml`

- [ ] **Step 1: Update `apps/web/package.json` lint scripts**

Change the `lint` and `lint:fix` scripts:

```diff
- "lint": "bun x --bun oxlint . && prettier --check .",
- "lint:fix": "bun x --bun oxlint --fix . && prettier --write .",
+ "lint": "biome check .",
+ "lint:fix": "biome check --fix .",
```

- [ ] **Step 2: Update `lefthook.yml`**

Replace the two parallel pre-commit jobs (oxlint + prettier) with a single biome job. Keep commitlint unchanged:

```yaml
pre-commit:
  jobs:
    - name: biome
      glob: "*.{js,jsx,ts,tsx,css,json,md,mdx,yaml,yml}"
      run: bunx biome check --fix {staged_files}
      stage_fixed: true

commit-msg:
  jobs:
    - name: commitlint
      run: bunx commitlint --edit {1}
```

- [ ] **Step 3: Verify turbo lint runs biome**

```bash
cd apps/web && bun run lint 2>&1 | head -5
```

Expected: Biome check output (violations expected at this point).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json lefthook.yml
git commit -m "chore: update lint scripts and lefthook for biome"
```

---

### Task 3: Auto-fix formatting and safe lint violations

Biome can auto-fix most violations. Run it once across the whole codebase.

- [ ] **Step 1: Run biome auto-fix**

```bash
bunx biome check --fix .
```

This will:

- Reformat all files (spaces → tabs, trailing commas, etc.)
- Fix `useLiteralKeys` (23 violations) — e.g. `obj["key"]` → `obj.key`
- Fix `useImportType` (14 violations) — adds `type` to type-only imports
- Fix `noUnusedImports` (2 violations) — removes unused imports
- Fix `useOptionalChain` (1 violation) — e.g. `a && a.b` → `a?.b`
- Fix `noNonNullAssertion` (1 violation) — removes `!` assertions
- Organize imports across all files

- [ ] **Step 2: Check remaining violations**

```bash
bunx biome check . --max-diagnostics=100 2>&1 | grep -E 'lint/' | sort -u
```

Expected remaining manual violations (these cannot be auto-fixed):

- `noArrayIndexKey` (~10) — array index used as React key
- `useExhaustiveDependencies` (~7) — missing/extra deps in useEffect/useCallback
- `noAssignInExpressions` (~1) — assignment inside expression
- `noImplicitAnyLet` (~1) — `let` without type annotation
- `noDocumentCookie` (~1) — direct document.cookie access
- `noRedeclare` (~1) — variable redeclaration

- [ ] **Step 3: Commit the auto-fixes**

```bash
git add -A
git commit -m "style: apply biome formatting and auto-fixes"
```

---

### Task 4: Fix `noArrayIndexKey` violations (~10 files)

These are React components using array index as `key` prop. Fix by using a unique identifier from the data instead.

- [ ] **Step 1: Find all violations**

```bash
bunx biome check . --max-diagnostics=100 2>&1 | grep 'noArrayIndexKey'
```

- [ ] **Step 2: Fix each violation**

For each file, replace the array index key with a meaningful unique identifier from the data. Common patterns:

- If iterating over objects with an `id` field, use `key={item.id}`
- If iterating over strings, use `key={value}` (the string itself)
- If iterating over objects without a unique field, use a combination of fields that creates uniqueness, e.g. `key={`${item.name}-${item.type}`}`

Read each file to understand the data being iterated, then pick the appropriate key.

- [ ] **Step 3: Verify fixes**

```bash
bunx biome check . --max-diagnostics=100 2>&1 | grep 'noArrayIndexKey'
```

Expected: No `noArrayIndexKey` violations.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: replace array index keys with stable identifiers"
```

---

### Task 5: Fix `useExhaustiveDependencies` violations (~7 files)

These are React hooks (useEffect, useCallback, useMemo) with incorrect dependency arrays.

- [ ] **Step 1: Find all violations**

```bash
bunx biome check . --max-diagnostics=100 2>&1 | grep 'useExhaustiveDependencies'
```

- [ ] **Step 2: Fix each violation**

For each file, read the hook and its dependencies. Common fixes:

- **Missing dependency:** Add the missing variable to the dependency array
- **Stale closure over callback:** Wrap the callback in `useCallback` and add it to deps
- **Object/array dependency causing infinite re-renders:** Extract the specific primitive values needed, or `useMemo` the object
- **Intentionally run-once effect:** If the effect genuinely should only run once (e.g., initialization), refactor to make dependencies stable (move creation into the effect, use refs, etc.)

Read each file carefully. The fix depends on the specific hook's intent.

- [ ] **Step 3: Verify fixes**

```bash
bunx biome check . --max-diagnostics=100 2>&1 | grep 'useExhaustiveDependencies'
```

Expected: No `useExhaustiveDependencies` violations.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: correct React hook dependency arrays"
```

---

### Task 6: Fix remaining lint violations

Handle the ~5 one-off violations that weren't auto-fixed.

- [ ] **Step 1: Find all remaining lint violations**

```bash
bunx biome check . --max-diagnostics=100 2>&1 | grep 'lint/'
```

- [ ] **Step 2: Fix `noAssignInExpressions`**

Find the assignment-in-expression and refactor to separate the assignment from the expression. For example:

```typescript
// Before
if (result = getValue()) { ... }
// After
const result = getValue();
if (result) { ... }
```

- [ ] **Step 3: Fix `noImplicitAnyLet`**

Add an explicit type annotation to the `let` variable.

- [ ] **Step 4: Fix `noDocumentCookie`**

Replace direct `document.cookie` access with a cookie utility or refactor the approach. Read the file to understand context.

- [ ] **Step 5: Fix `noRedeclare`**

Rename the redeclared variable or restructure the code to avoid the redeclaration.

- [ ] **Step 6: Verify all lint violations are resolved**

```bash
bunx biome check .
```

Expected: `Checked N files in Xms. No fixes applied.` with zero errors and zero warnings.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: resolve remaining biome lint violations"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full biome check**

```bash
bunx biome check .
```

Expected: Clean — no errors, no warnings.

- [ ] **Step 2: Run turbo lint**

```bash
bun run lint
```

Expected: Clean exit.

- [ ] **Step 3: Run tests**

```bash
bun run test
```

Expected: All tests pass. The formatting/lint changes should not affect runtime behavior.

- [ ] **Step 4: Verify dev server starts**

```bash
cd apps/web && timeout 15 bun run dev 2>&1 | head -20
```

Expected: Vite dev server starts without errors.
