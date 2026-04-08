import { beforeEach, describe, expect, test, vi } from "vitest";

const dbSelect = vi.fn();
const dbUpdate = vi.fn();

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
		dbSelect.mockReturnValueOnce({
			from: () => ({
				where: () => ({
					orderBy: () => ({
						limit: () => ({
							get: () => pendingJob,
						}),
					}),
				}),
			}),
		});
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
		dbSelect.mockReturnValueOnce({
			from: () => ({
				where: () => ({
					orderBy: () => ({
						limit: () => ({
							get: () => ({
								id: 17,
								status: "pending",
								attempts: 0,
								maxAttempts: 3,
								priority: 0,
								createdAt: new Date("2026-04-07T00:00:00.000Z"),
							}),
						}),
					}),
				}),
			}),
		});
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
});
