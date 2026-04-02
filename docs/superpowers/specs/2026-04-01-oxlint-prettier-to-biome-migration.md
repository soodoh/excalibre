# Migration: oxlint + prettier → Biome

## Summary

Replace oxlint and prettier with Biome for unified linting and formatting in a single tool with a single config.

## Motivation

- Consolidate two tools (oxlint for linting, prettier for formatting) into one (Biome)
- Single config file instead of three (oxlint.config.ts, .prettierrc, .prettierignore)
- Faster execution — Biome runs linting and formatting in a single pass
- Consistent with the diloreto-website project setup

## Config

Copy `biome.json` from `diloreto-website` verbatim:

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

Key features:

- Git-aware VCS integration with `.gitignore` respect
- Ignore patterns for node_modules, .output, dist, routeTree.gen.ts
- Import organization via `assist.actions`
- Tailwind CSS directive parsing for `@apply`, `@theme`, etc.
- Recommended lint rules + no default React imports
- Default formatting (tabs for indentation, consistent with Biome defaults)

## Files to Remove

- `oxlint.config.ts` — replaced by biome.json
- `.prettierrc` — replaced by biome.json
- `.prettierignore` — replaced by biome.json `files.includes`

## Dependencies

### Remove from root `package.json`

- `oxlint`
- `@standard-config/oxlint`
- `oxlint-tsgolint`
- `prettier`

### Add to root `package.json`

- `@biomejs/biome`

## File Changes

### `biome.json` (new, repo root)

Exact config shown above.

### `apps/web/package.json`

Update lint scripts:

```diff
- "lint": "bun x --bun oxlint . && prettier --check .",
- "lint:fix": "bun x --bun oxlint --fix . && prettier --write .",
+ "lint": "biome check .",
+ "lint:fix": "biome check --fix .",
```

### `lefthook.yml`

Replace two parallel pre-commit jobs with one:

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

## Lint Violations

All code that doesn't comply with Biome's recommended rules will be refactored to comply. No rule suppressions unless truly unavoidable. This includes shadcn/ui components and hooks — they are not excluded from linting.

## Unchanged

- commitlint setup (lefthook commit-msg hook, @commitlint/cli, @commitlint/config-conventional)
- turbo.json task definitions
- docs app (has no lint scripts)
