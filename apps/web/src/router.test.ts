import { beforeEach, describe, expect, test, vi } from "vitest";

const createRouter = vi.fn(() => ({ id: "router" }));
const setupRouterSsrQueryIntegration = vi.fn();
const getQueryClient = vi.fn(() => ({ id: "query-client" }));
const ensureRuntimeStarted = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	createRouter,
}));

vi.mock("@tanstack/react-router-ssr-query", () => ({
	setupRouterSsrQueryIntegration,
}));

vi.mock("src/lib/query-client", () => ({
	getQueryClient,
}));

vi.mock("src/routeTree.gen", () => ({
	routeTree: { id: "route-tree" },
}));

vi.mock("src/server/runtime-bootstrap", () => ({
	ensureRuntimeStarted,
}));

describe("getRouter", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	test("logs bootstrap failures instead of leaving an unhandled rejection", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		ensureRuntimeStarted.mockRejectedValueOnce(new Error("bootstrap failed"));

		const { getRouter } = await import("src/router");

		getRouter();

		await vi.waitFor(() => {
			expect(consoleError).toHaveBeenCalledWith(
				"Failed to start runtime services",
				expect.objectContaining({ message: "bootstrap failed" }),
			);
		});
	});
});
