import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary", "html"],
			include: ["src/**"],
			exclude: [
				"src/routeTree.gen.ts",
				"src/**/*.test.ts",
				"src/**/*.browser.test.tsx",
			],
		},
	},
});
