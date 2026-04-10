import { beforeEach, describe, expect, test, vi } from "vitest";

// --- Mock setup ---
const requireAdmin = vi.fn();
const scanLibrary = vi.fn();
const scanAllLibraries = vi.fn();

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: unknown) => handler,
		inputValidator: () => ({
			handler: (handler: unknown) => handler,
		}),
	}),
}));

vi.mock("src/server/middleware", () => ({
	requireAdmin,
}));

vi.mock("./scanner", () => ({
	scanLibrary,
	scanAllLibraries,
}));

vi.mock("zod", async () => {
	const actual = await vi.importActual<typeof import("zod")>("zod");
	return actual;
});

describe("scan-actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("triggerScanFn", () => {
		test("calls requireAdmin before scanning", async () => {
			requireAdmin.mockResolvedValueOnce(undefined);
			scanLibrary.mockResolvedValueOnce({ scanned: 5 });

			const { triggerScanFn } = await import("src/server/scan-actions");

			await triggerScanFn({ data: { libraryId: 1 } });

			expect(requireAdmin).toHaveBeenCalled();
		});

		test("calls scanLibrary with the given libraryId", async () => {
			requireAdmin.mockResolvedValueOnce(undefined);
			scanLibrary.mockResolvedValueOnce({ scanned: 5 });

			const { triggerScanFn } = await import("src/server/scan-actions");

			const result = await triggerScanFn({ data: { libraryId: 42 } });

			expect(scanLibrary).toHaveBeenCalledWith(42);
			expect(result).toEqual({ scanned: 5 });
		});

		test("propagates error from requireAdmin", async () => {
			requireAdmin.mockRejectedValueOnce(new Error("Forbidden"));

			const { triggerScanFn } = await import("src/server/scan-actions");

			await expect(triggerScanFn({ data: { libraryId: 1 } })).rejects.toThrow(
				"Forbidden",
			);

			expect(scanLibrary).not.toHaveBeenCalled();
		});
	});

	describe("triggerScanAllFn", () => {
		test("calls requireAdmin before scanning all", async () => {
			requireAdmin.mockResolvedValueOnce(undefined);
			scanAllLibraries.mockResolvedValueOnce(undefined);

			const { triggerScanAllFn } = await import("src/server/scan-actions");

			await triggerScanAllFn({});

			expect(requireAdmin).toHaveBeenCalled();
		});

		test("calls scanAllLibraries", async () => {
			requireAdmin.mockResolvedValueOnce(undefined);
			scanAllLibraries.mockResolvedValueOnce({ total: 10 });

			const { triggerScanAllFn } = await import("src/server/scan-actions");

			const result = await triggerScanAllFn({});

			expect(scanAllLibraries).toHaveBeenCalled();
			expect(result).toEqual({ total: 10 });
		});

		test("propagates error from requireAdmin", async () => {
			requireAdmin.mockRejectedValueOnce(new Error("Not an admin"));

			const { triggerScanAllFn } = await import("src/server/scan-actions");

			await expect(triggerScanAllFn({})).rejects.toThrow("Not an admin");

			expect(scanAllLibraries).not.toHaveBeenCalled();
		});
	});
});
