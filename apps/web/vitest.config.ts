import { playwright } from "@vitest/browser-playwright";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		testTimeout: 15000,
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary", "html"],
			include: ["src/**"],
			exclude: [
				"src/routeTree.gen.ts",
				"src/**/*.test.ts",
				"src/**/*.browser.test.tsx",
				// Infrastructure / framework glue — declarative config or
				// environment-dependent setup that cannot be unit-tested in isolation.
				"src/db/index.ts", // DB connection setup (needs bun:sqlite)
				"src/db/migrate.ts", // CLI migration script
				"src/db/schema/**", // Declarative Drizzle table definitions
				"src/lib/auth.ts", // better-auth config wiring
				"src/lib/auth-client.ts", // better-auth client wrapper
				"src/lib/query-client.ts", // React Query provider setup
				"src/lib/bun-sqlite-browser-shim.ts", // No-op browser shim
				"src/router.tsx", // TanStack Router bootstrap
				"src/routeTree.gen.ts", // Generated route tree
				// Server entry points registered with TanStack Start — executed only
				// through the real router, not addressable from unit tests.
				"src/routes/api/kobo/**",
				"src/routes/api/kosync/**",
				"src/routes/api/opds/index.ts",
				"src/routes/api/opds/search.ts",
				"src/routes/api/opds/search.xml.ts",
				// Settings pages that are guard-only (beforeLoad + static
				// marketing copy); their meaningful behavior is covered by
				// integration tests against the underlying server functions.
				"src/routes/_authed/settings/general.tsx",
				"src/routes/_authed/settings/users.tsx",
				// Reader UI. Relies on external iframe/ReactReader libraries
				// whose behavior cannot be faithfully exercised in the headless
				// browser runner. Core ReaderPage route coverage remains.
				"src/components/reader/ebook-reader.tsx",
				"src/components/reader/pdf-reader.tsx",
				// shadcn/ui primitives — shipped largely untouched. Coverage
				// is driven by consumer component tests, and the broader suite
				// already exercises the critical paths.
				"src/components/ui/sidebar.tsx",
				"src/components/ui/dropdown-menu.tsx",
				"src/components/ui/sonner.tsx",
				// App layout sidebar is largely shadcn sidebar plumbing.
				"src/components/layout/app-sidebar.tsx",
			],
			// NOTE: we target ~95% statements/lines after excluding declarative
			// infrastructure (db connection, schema, better-auth config, shadcn
			// primitives, reader iframe shells, etc.). Branches trail because
			// many conditional renders in UI routes depend on query/mutation
			// transitions that are exhaustively covered through other paths.
			thresholds: {
				statements: 94,
				branches: 85,
				functions: 88,
				lines: 94,
			},
		},
		projects: [
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include: ["src/**/*.test.ts"],
				},
			},
			{
				extends: true,
				optimizeDeps: {
					exclude: ["@tanstack/react-start", "@tanstack/start-server-core"],
				},
				test: {
					name: "browser",
					include: ["src/**/*.browser.test.tsx"],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
