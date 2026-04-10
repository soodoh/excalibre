import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// --- Mock setup ---
const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();

const scanLibrary = vi.fn();
const ensureJobWorkerStarted = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
	},
}));

vi.mock("src/db/schema", () => ({
	libraries: { id: "libraries.id" },
}));

vi.mock("src/server/scanner", () => ({
	scanLibrary,
}));

vi.mock("src/server/job-worker", () => ({
	ensureJobWorkerStarted,
}));

describe("scheduler", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();

		dbSelectMock.mockReturnValue({ from: dbSelectFromMock });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	test("ensureSchedulerStarted calls ensureJobWorkerStarted", async () => {
		const { ensureSchedulerStarted } = await import("src/server/scheduler");

		ensureSchedulerStarted();

		expect(ensureJobWorkerStarted).toHaveBeenCalled();
	});

	test("ensureSchedulerStarted is idempotent (only starts once)", async () => {
		const { ensureSchedulerStarted } = await import("src/server/scheduler");

		ensureSchedulerStarted();
		ensureSchedulerStarted();
		ensureSchedulerStarted();

		expect(ensureJobWorkerStarted).toHaveBeenCalledTimes(1);
	});

	test("runs checkAndRunDueScans after interval", async () => {
		dbSelectFromMock.mockResolvedValue([]);

		const { ensureSchedulerStarted } = await import("src/server/scheduler");

		ensureSchedulerStarted();

		// Advance past the 60-second interval
		await vi.advanceTimersByTimeAsync(60_000);

		expect(dbSelectMock).toHaveBeenCalled();
	});

	test("scans library when it is due", async () => {
		const pastDate = new Date(Date.now() - 120 * 60 * 1000); // 2 hours ago
		dbSelectFromMock.mockResolvedValue([
			{
				id: 1,
				scanInterval: 60, // 60 minutes
				lastScannedAt: pastDate,
			},
		]);
		scanLibrary.mockResolvedValue(undefined);

		const { ensureSchedulerStarted } = await import("src/server/scheduler");

		ensureSchedulerStarted();
		await vi.advanceTimersByTimeAsync(60_000);

		expect(scanLibrary).toHaveBeenCalledWith(1);
	});

	test("skips library when scan is not due yet", async () => {
		const recentDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
		dbSelectFromMock.mockResolvedValue([
			{
				id: 1,
				scanInterval: 60, // 60 minutes
				lastScannedAt: recentDate,
			},
		]);

		const { ensureSchedulerStarted } = await import("src/server/scheduler");

		ensureSchedulerStarted();
		await vi.advanceTimersByTimeAsync(60_000);

		expect(scanLibrary).not.toHaveBeenCalled();
	});

	test("scans library when lastScannedAt is null", async () => {
		dbSelectFromMock.mockResolvedValue([
			{
				id: 2,
				scanInterval: 30,
				lastScannedAt: null,
			},
		]);
		scanLibrary.mockResolvedValue(undefined);

		const { ensureSchedulerStarted } = await import("src/server/scheduler");

		ensureSchedulerStarted();
		await vi.advanceTimersByTimeAsync(60_000);

		expect(scanLibrary).toHaveBeenCalledWith(2);
	});

	test("continues scanning other libraries when one fails", async () => {
		const pastDate = new Date(Date.now() - 120 * 60 * 1000);
		dbSelectFromMock.mockResolvedValue([
			{
				id: 1,
				scanInterval: 60,
				lastScannedAt: pastDate,
			},
			{
				id: 2,
				scanInterval: 60,
				lastScannedAt: pastDate,
			},
		]);
		scanLibrary.mockRejectedValueOnce(new Error("Scan failed"));
		scanLibrary.mockResolvedValueOnce(undefined);

		const { ensureSchedulerStarted } = await import("src/server/scheduler");

		ensureSchedulerStarted();
		await vi.advanceTimersByTimeAsync(60_000);

		expect(scanLibrary).toHaveBeenCalledWith(1);
		expect(scanLibrary).toHaveBeenCalledWith(2);
	});
});
