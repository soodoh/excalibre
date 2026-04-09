import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	{
		extends: "./vitest.config.ts",
		test: {
			name: "node",
			environment: "node",
			include: ["src/**/*.test.ts"],
		},
	},
	{
		extends: "./vitest.config.ts",
		test: {
			name: "browser",
			include: ["src/**/*.browser.test.tsx"],
			browser: {
				enabled: true,
				provider: "playwright",
				instances: [{ browser: "chromium" }],
			},
		},
	},
]);
