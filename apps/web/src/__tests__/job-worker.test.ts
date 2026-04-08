import { beforeEach, describe, expect, test, vi } from "vitest";

const dbSelect = vi.fn();
const dbUpdate = vi.fn();
const ensureSchedulerStarted = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelect,
		update: dbUpdate,
	},
}));

vi.mock("src/db/schema", () => ({
	jobs: {
		id: "id",
		status: "status",
		attempts: "attempts",
		maxAttempts: "maxAttempts",
		priority: "priority",
		createdAt: "createdAt",
		startedAt: "startedAt",
	},
}));

vi.mock("src/server/converter", () => ({
	convertBook: vi.fn(),
}));

vi.mock("src/server/epub-fixer", () => ({
	fixEpub: vi.fn(),
}));

vi.mock("src/server/scheduler", () => ({
	ensureSchedulerStarted,
}));

function mockPendingJobSelect(job: unknown) {
	return {
		from: () => ({
			where: () => ({
				orderBy: () => ({
					limit: () => ({
						get: () => job,
					}),
				}),
			}),
		}),
	};
}

describe("claimNextJob", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	test("returns the claimed job when the pending row is updated successfully", async () => {
		const pendingJob = {
			id: 17,
			type: "convert",
			status: "pending",
			attempts: 0,
			maxAttempts: 3,
			priority: 0,
			payload: {
				bookFileId: 42,
				targetFormat: "kepub",
			},
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		};
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(pendingJob));
		dbUpdate.mockReturnValueOnce({
			set: () => ({
				where: () => ({
					run: () => ({ changes: 1 }),
				}),
			}),
		});

		const { claimNextJob } = await import("src/server/job-worker");

		const result = claimNextJob();

		expect(result).toMatchObject({
			...pendingJob,
			status: "running",
			attempts: 1,
		});
		expect(result?.startedAt).toBeInstanceOf(Date);
	});

	test("returns null when another worker already claimed the row", async () => {
		dbSelect.mockReturnValueOnce(
			mockPendingJobSelect({
				id: 17,
				status: "pending",
				attempts: 0,
				maxAttempts: 3,
				priority: 0,
				createdAt: new Date("2026-04-07T00:00:00.000Z"),
			}),
		);
		dbUpdate.mockReturnValueOnce({
			set: () => ({
				where: () => ({
					run: () => ({ changes: 0 }),
				}),
			}),
		});

		const { claimNextJob } = await import("src/server/job-worker");

		const result = claimNextJob();

		expect(result).toBeNull();
	});

	test("keeps the worker hot after a lost claim when other pending jobs remain", async () => {
		dbSelect
			.mockReturnValueOnce(
				mockPendingJobSelect({
					id: 17,
					type: "convert",
					status: "pending",
					attempts: 0,
					maxAttempts: 3,
					priority: 0,
					payload: {
						bookFileId: 42,
						targetFormat: "kepub",
					},
					createdAt: new Date("2026-04-07T00:00:00.000Z"),
				}),
			)
			.mockReturnValueOnce(
				mockPendingJobSelect({
					id: 18,
					status: "pending",
					attempts: 0,
					maxAttempts: 3,
					priority: 1,
					createdAt: new Date("2026-04-07T00:01:00.000Z"),
				}),
			);
		dbUpdate.mockReturnValueOnce({
			set: () => ({
				where: () => ({
					run: () => ({ changes: 0 }),
				}),
			}),
		});

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(true);
	});
});

describe("ensureRuntimeStarted", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	test("retries startup after an initialization failure", async () => {
		ensureSchedulerStarted
			.mockImplementationOnce(() => {
				throw new Error("scheduler boot failed");
			})
			.mockImplementationOnce(() => undefined);

		const { ensureRuntimeStarted } = await import(
			"src/server/runtime-bootstrap"
		);

		await expect(ensureRuntimeStarted()).rejects.toThrow(
			"scheduler boot failed",
		);
		await expect(ensureRuntimeStarted()).resolves.toBeUndefined();
		expect(ensureSchedulerStarted).toHaveBeenCalledTimes(2);
	});
});
