import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

describe("processNextJob", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	test("returns false when no pending jobs exist", async () => {
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(null));

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(false);
	});

	test("processes a convert job successfully", async () => {
		const { convertBook } = await import("src/server/converter");
		(convertBook as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			id: 99,
		});

		const pendingJob = {
			id: 17,
			type: "convert",
			status: "pending",
			attempts: 0,
			maxAttempts: 3,
			priority: 0,
			payload: { bookFileId: 42, targetFormat: "kepub" },
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		};
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(pendingJob));
		const updateSetMock = vi.fn();
		const updateWhereMock = vi.fn();
		const updateRunMock = vi.fn();
		dbUpdate
			.mockReturnValueOnce({
				set: () => ({
					where: () => ({
						run: () => ({ changes: 1 }),
					}),
				}),
			})
			.mockReturnValueOnce({
				set: (values: unknown) => {
					updateSetMock(values);
					return {
						where: (clause: unknown) => {
							updateWhereMock(clause);
							return {
								run: () => {
									updateRunMock();
								},
							};
						},
					};
				},
			});

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(true);
		expect(convertBook).toHaveBeenCalledWith(42, "kepub");
		expect(updateSetMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "completed",
				result: { bookFileId: 99 },
			}),
		);
	});

	test("processes an epub_fix job successfully", async () => {
		const { fixEpub } = await import("src/server/epub-fixer");
		(fixEpub as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 50 });

		const pendingJob = {
			id: 18,
			type: "epub_fix",
			status: "pending",
			attempts: 0,
			maxAttempts: 3,
			priority: 1,
			payload: { bookFileId: 55 },
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		};
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(pendingJob));
		const updateSetMock = vi.fn();
		dbUpdate
			.mockReturnValueOnce({
				set: () => ({
					where: () => ({
						run: () => ({ changes: 1 }),
					}),
				}),
			})
			.mockReturnValueOnce({
				set: (values: unknown) => {
					updateSetMock(values);
					return {
						where: () => ({
							run: () => {},
						}),
					};
				},
			});

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(true);
		expect(fixEpub).toHaveBeenCalledWith(55);
		expect(updateSetMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "completed",
				result: { bookFileId: 50 },
			}),
		);
	});

	test("handles epub_fix returning null (skipped)", async () => {
		const { fixEpub } = await import("src/server/epub-fixer");
		(fixEpub as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

		const pendingJob = {
			id: 19,
			type: "epub_fix",
			status: "pending",
			attempts: 0,
			maxAttempts: 3,
			priority: 1,
			payload: { bookFileId: 55 },
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		};
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(pendingJob));
		const updateSetMock = vi.fn();
		dbUpdate
			.mockReturnValueOnce({
				set: () => ({
					where: () => ({
						run: () => ({ changes: 1 }),
					}),
				}),
			})
			.mockReturnValueOnce({
				set: (values: unknown) => {
					updateSetMock(values);
					return {
						where: () => ({
							run: () => {},
						}),
					};
				},
			});

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(true);
		expect(updateSetMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "completed",
				result: { skipped: true },
			}),
		);
	});

	test("handles unknown job type with error", async () => {
		const pendingJob = {
			id: 20,
			type: "unknown_type",
			status: "pending",
			attempts: 0,
			maxAttempts: 1,
			priority: 0,
			payload: {},
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		};
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(pendingJob));
		const updateSetMock = vi.fn();
		dbUpdate
			.mockReturnValueOnce({
				set: () => ({
					where: () => ({
						run: () => ({ changes: 1 }),
					}),
				}),
			})
			.mockReturnValueOnce({
				set: (values: unknown) => {
					updateSetMock(values);
					return {
						where: () => ({
							run: () => {},
						}),
					};
				},
			});

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(true);
		expect(updateSetMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "failed",
				error: "Unknown job type: unknown_type",
			}),
		);
	});

	test("sets status to pending on error when retries remain", async () => {
		const { convertBook } = await import("src/server/converter");
		(convertBook as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("Conversion failed"),
		);

		const pendingJob = {
			id: 21,
			type: "convert",
			status: "pending",
			attempts: 0,
			maxAttempts: 3,
			priority: 0,
			payload: { bookFileId: 42, targetFormat: "pdf" },
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		};
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(pendingJob));
		const updateSetMock = vi.fn();
		dbUpdate
			.mockReturnValueOnce({
				set: () => ({
					where: () => ({
						run: () => ({ changes: 1 }),
					}),
				}),
			})
			.mockReturnValueOnce({
				set: (values: unknown) => {
					updateSetMock(values);
					return {
						where: () => ({
							run: () => {},
						}),
					};
				},
			});

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(true);
		expect(updateSetMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "pending",
				error: "Conversion failed",
			}),
		);
	});

	test("sets status to failed on final attempt error", async () => {
		const { convertBook } = await import("src/server/converter");
		(convertBook as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("Conversion failed"),
		);

		const pendingJob = {
			id: 22,
			type: "convert",
			status: "pending",
			attempts: 2,
			maxAttempts: 3,
			priority: 0,
			payload: { bookFileId: 42, targetFormat: "pdf" },
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		};
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(pendingJob));
		const updateSetMock = vi.fn();
		dbUpdate
			.mockReturnValueOnce({
				set: () => ({
					where: () => ({
						run: () => ({ changes: 1 }),
					}),
				}),
			})
			.mockReturnValueOnce({
				set: (values: unknown) => {
					updateSetMock(values);
					return {
						where: () => ({
							run: () => {},
						}),
					};
				},
			});

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(true);
		expect(updateSetMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "failed",
				error: "Conversion failed",
			}),
		);
	});

	test("handles non-Error thrown values", async () => {
		const { convertBook } = await import("src/server/converter");
		(convertBook as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			"string error",
		);

		const pendingJob = {
			id: 23,
			type: "convert",
			status: "pending",
			attempts: 0,
			maxAttempts: 1,
			priority: 0,
			payload: { bookFileId: 42, targetFormat: "pdf" },
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		};
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(pendingJob));
		const updateSetMock = vi.fn();
		dbUpdate
			.mockReturnValueOnce({
				set: () => ({
					where: () => ({
						run: () => ({ changes: 1 }),
					}),
				}),
			})
			.mockReturnValueOnce({
				set: (values: unknown) => {
					updateSetMock(values);
					return {
						where: () => ({
							run: () => {},
						}),
					};
				},
			});

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(true);
		expect(updateSetMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "failed",
				error: "string error",
			}),
		);
	});

	test("handles claim result where changes is not a number", async () => {
		const pendingJob = {
			id: 24,
			type: "convert",
			status: "pending",
			attempts: 0,
			maxAttempts: 3,
			priority: 0,
			payload: { bookFileId: 42, targetFormat: "kepub" },
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		};
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(pendingJob));
		dbUpdate.mockReturnValueOnce({
			set: () => ({
				where: () => ({
					run: () => ({ notChanges: "something" }),
				}),
			}),
		});
		// Second select for contended check — no more pending jobs
		dbSelect.mockReturnValueOnce(mockPendingJobSelect(null));

		const { processNextJob } = await import("src/server/job-worker");

		const result = await processNextJob();

		expect(result).toBe(false);
	});
});

describe("ensureJobWorkerStarted", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("starts the worker loop only once and uses POLL_INTERVAL when idle", async () => {
		// Set up a no-pending-job mock so the worker loop settles
		dbSelect.mockReturnValue(mockPendingJobSelect(null));

		const { ensureJobWorkerStarted } = await import("src/server/job-worker");

		// The function should not throw
		ensureJobWorkerStarted();
		// Calling again should be a no-op (workerStarted guard)
		ensureJobWorkerStarted();

		// First loop iteration runs immediately
		await vi.advanceTimersByTimeAsync(0);
		expect(dbSelect).toHaveBeenCalledTimes(1);

		// After 5s poll interval, next iteration runs
		await vi.advanceTimersByTimeAsync(5000);
		expect(dbSelect).toHaveBeenCalledTimes(2);
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

	test("returns the same promise on subsequent calls after success", async () => {
		ensureSchedulerStarted.mockImplementation(() => undefined);

		const { ensureRuntimeStarted } = await import(
			"src/server/runtime-bootstrap"
		);

		const p1 = ensureRuntimeStarted();
		const p2 = ensureRuntimeStarted();

		// Both calls should return the same promise
		expect(p1).toBe(p2);
		await expect(p1).resolves.toBeUndefined();
		// Only called once because the promise is cached
		expect(ensureSchedulerStarted).toHaveBeenCalledTimes(1);
	});
});
