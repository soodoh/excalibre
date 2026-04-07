# Access-Control Protocol Regression Fixes

**Date:** 2026-04-07
**Status:** Approved
**Scope:** OPDS auth propagation, file-route access error handling, and Kobo empty-sync behavior introduced by the access-control patch

## Summary

Fix the protocol regressions introduced while adding library- and book-level access control:

- Preserve OPDS query-string authentication on followable feed links
- Return intended 403/404 responses from Kobo and OPDS file-serving handlers when access-control checks fail
- Continue advancing Kobo sync tokens even when a user currently has zero accessible libraries

The fix is intentionally narrow. It stays inside the existing OPDS and Kobo route layer plus a small amount of shared server glue. It does not change the authentication model, library-access rules, or feed structure beyond restoring correct protocol behavior.

## Motivation

The current patch has three concrete regressions:

1. OPDS clients authenticated with `?apikey=` can load the first page of some feeds, but follow-up links lose credentials and fail with `401 Unauthorized`.
2. Newly added access-control checks in some Kobo and OPDS asset handlers throw `HttpError`, but those routes do not translate the error into an HTTP response, so clients receive `500 Internal Server Error` instead of `403` or `404`.
3. Kobo sync exits early when a user has no accessible libraries and skips `x-kobo-synctoken`, which prevents devices from advancing to a clean empty state after access is revoked.

These are protocol-level failures. They break otherwise valid clients without changing the underlying authorization decision.

## Constraints

- Follow existing TanStack file-route patterns
- Reuse the current `RequestAuth`, `HttpError`, and access-control helpers
- Avoid unrelated refactors outside OPDS/Kobo request handling
- Keep new test scaffolding minimal and reusable
- Do not change behavior for routes that are already correct and outside these request paths

## Design

### 1. OPDS Authenticated Link Emission

All OPDS links that a client may follow must preserve request authentication the same way acquisition and cover links already do.

This applies to:

- feed `self` links
- pagination links such as `previous` and `next`
- navigation-entry links emitted by shared OPDS helpers
- adjacent OPDS feed routes in the same patch where the same raw-link pattern appears

Behavior:

- Requests authenticated with `?apikey=` emit followable links with the same `apikey` appended.
- Requests authenticated with HTTP Basic auth emit clean links without query auth, since there is no query token to propagate.
- Existing non-feed asset URLs that already append auth continue using the same helper.

Implementation direction:

- Continue using `appendRequestAuthToUrl` as the single source of truth for auth propagation.
- Pass `RequestAuth` through shared OPDS feed builders where necessary.
- Replace raw `self`/pagination/navigation href construction in affected routes with helper-backed generation.

This is broader than the single reviewed line in `all.ts` because the same failure mode appears in related OPDS routes and should be fixed consistently in this patch.

### 2. File-Route Access Error Translation

Access-control assertions should remain in the route handlers where they currently enforce visibility, but the route boundary must translate expected `HttpError` failures into protocol-correct responses.

Affected behavior:

- Valid Kobo token or OPDS auth + lost book/library access returns `403` or `404`, not `500`
- Invalid route parameters still return `400`
- Missing files on disk still return `404`
- Unexpected filesystem, archive, parsing, or database failures still return `500`

Primary targets:

- Kobo download route
- Kobo reading-state route
- OPDS PSE page-stream route
- any adjacent related asset handler in the same patch that now calls access assertions without catching `HttpError`

Implementation direction:

- Normalize the existing pattern already used by `/api/books/$fileId` and `/api/covers/$bookId`
- If duplication becomes noisy, introduce a very small helper that converts `HttpError` to `Response` without hiding unexpected exceptions
- Keep handler business logic local; do not build a generic framework wrapper

### 3. Kobo Empty-Sync Semantics

The Kobo sync route must continue generating a fresh sync token even when the authenticated user has zero accessible libraries.

Required behavior:

- If accessible libraries are empty, return `200 OK`
- Response body is an empty changes array
- Response headers still include a fresh `x-kobo-synctoken`
- `x-kobo-sync: continue` is only emitted when there is another page of actual results

Query behavior:

- For non-empty library access, continue filtering book queries to accessible libraries only
- For empty access, skip querying books but still run the sync-token response path

This preserves the access-control intent while allowing devices to observe that the server state has advanced to “no accessible content”.

## Data Flow

### OPDS feed request

1. Authenticate request as OPDS Basic auth or `apikey`
2. Build feed metadata and entry links through auth-aware URL helpers
3. Emit XML where every followable feed link preserves the same request-auth mode

### Kobo/OPDS asset request

1. Authenticate request
2. Validate route params
3. Run access-control assertion
4. If assertion throws `HttpError`, convert it directly to the matching HTTP response
5. Otherwise continue serving the file/state payload

### Kobo sync request with zero access

1. Authenticate Kobo token
2. Resolve accessible library IDs
3. Detect zero-access state
4. Build a fresh sync token and response headers
5. Return empty change set with that token

## Error Handling

- `HttpError` subclasses are expected control-flow errors at the route boundary and must map to their declared status codes.
- Invalid numeric params remain `400`.
- Missing records or revoked access continue to surface as `404` or `403` based on the existing access-control helper behavior.
- Unexpected exceptions are not swallowed or downgraded; they remain `500`.

## Testing Strategy

Minimum verification bar: mixed helper and route-level coverage.

### Helper tests

- Extend request-auth helper tests to cover followable OPDS feed URLs with existing query params
- Keep auth-propagation assertions focused on generated URLs rather than broad XML snapshots where possible

### Route regression tests

Add focused tests for the affected route behaviors:

- OPDS feed responses preserve `apikey` on followable links such as `self`, `previous`, and `next`
- Kobo download/state and OPDS PSE routes return non-500 status codes when access-control checks fail
- Kobo sync returns an empty payload plus `x-kobo-synctoken` when the user has zero accessible libraries

### Verification commands

- Run the relevant Vitest subset for request-auth and any new regression tests
- Run any targeted command needed to verify the affected handlers if route tests require a small harness

## Out of Scope

- Reworking OPDS feed structure beyond auth propagation
- Changing authorization rules or access-control semantics
- Broad route abstraction for all server handlers
- Unrelated Kobo protocol improvements
- Refactoring unaffected routes for style consistency alone

## Implementation Notes

- Prefer small shared helpers only where they remove repeated protocol logic without obscuring route behavior.
- Keep changes compatible with the current in-progress access-control patch rather than trying to rebase the architecture.
- Because the worktree contains unrelated edits, commit only this spec file during the design phase.
