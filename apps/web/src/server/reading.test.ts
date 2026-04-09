import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAuth = vi.fn();
const assertUserCanAccessBook = vi.fn();

const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectWhereMock = vi.fn();

const dbUpdateMock = vi.fn();
const dbUpdateSetMock = vi.fn();
const dbUpdateWhereMock = vi.fn();
const dbUpdateReturningMock = vi.fn();

const dbInsertMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertReturningMock = vi.fn();

const readingProgressFindFirst = vi.fn();

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: unknown) => handler,
		inputValidator: () => ({
			handler: (handler: unknown) => handler,
		}),
	}),
}));

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...clauses: unknown[]) => ({ clauses })),
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
		update: dbUpdateMock,
		insert: dbInsertMock,
		query: {
			readingProgress: { findFirst: readingProgressFindFirst },
		},
	},
}));

vi.mock("src/server/middleware", () => ({
	requireAuth,
}));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessBook,
}));

vi.mock("src/server/reading-utils", () => ({
	normalizeReadingProgress: vi.fn((p: number) => {
		if (p < 0) return 0;
		if (p > 1) return 1;
		return p;
	}),
}));

const selectChain = {
	from: dbSelectFromMock,
	where: dbSelectWhereMock,
};

const updateChain = {
	set: dbUpdateSetMock,
	where: dbUpdateWhereMock,
	returning: dbUpdateReturningMock,
};

const insertChain = {
	values: dbInsertValuesMock,
	returning: dbInsertReturningMock,
};

describe("reading server functions", () => {
	const mockSession = {
		user: { id: "user-1", role: "user" },
	};

	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);

		dbUpdateMock.mockReturnValue(updateChain);
		dbUpdateSetMock.mockReturnValue(updateChain);
		dbUpdateWhereMock.mockReturnValue(updateChain);

		dbInsertMock.mockReturnValue(insertChain);
		dbInsertValuesMock.mockReturnValue(insertChain);
	});

	describe("getReadingProgressFn", () => {
		test("calls requireAuth and assertUserCanAccessBook", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getReadingProgressFn } = await import("src/server/reading");

			await getReadingProgressFn({ data: { bookId: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith("user-1", 1, "user");
		});

		test("returns progress entries for the given book", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			const mockProgress = [
				{
					id: 1,
					userId: "user-1",
					bookId: 1,
					deviceType: "web",
					progress: 0.5,
					isFinished: false,
				},
				{
					id: 2,
					userId: "user-1",
					bookId: 1,
					deviceType: "koreader",
					progress: 0.3,
					isFinished: false,
				},
			];
			dbSelectWhereMock.mockResolvedValueOnce(mockProgress);

			const { getReadingProgressFn } = await import("src/server/reading");

			const result = await getReadingProgressFn({ data: { bookId: 1 } });

			expect(result).toEqual(mockProgress);
		});

		test("returns empty array when no progress exists", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getReadingProgressFn } = await import("src/server/reading");

			const result = await getReadingProgressFn({ data: { bookId: 99 } });

			expect(result).toEqual([]);
		});

		test("propagates error from assertUserCanAccessBook", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { getReadingProgressFn } = await import("src/server/reading");

			await expect(
				getReadingProgressFn({ data: { bookId: 1 } }),
			).rejects.toThrow("Forbidden");
		});
	});

	describe("saveReadingProgressFn", () => {
		const baseInput = {
			bookId: 1,
			deviceType: "web" as const,
			progress: 0.5,
		};

		test("inserts new record when no existing record found", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingProgressFindFirst.mockResolvedValueOnce(null);

			const insertedRecord = {
				id: 1,
				userId: "user-1",
				bookId: 1,
				deviceType: "web",
				progress: 0.5,
				isFinished: false,
			};
			dbInsertReturningMock.mockResolvedValueOnce([insertedRecord]);

			const { saveReadingProgressFn } = await import("src/server/reading");

			const result = await saveReadingProgressFn({ data: baseInput });

			expect(result).toEqual(insertedRecord);
			expect(dbInsertMock).toHaveBeenCalled();
			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-1",
					bookId: 1,
					deviceType: "web",
					progress: 0.5,
					isFinished: false,
				}),
			);
		});

		test("updates existing record when one is found", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			const existingRecord = {
				id: 5,
				userId: "user-1",
				bookId: 1,
				deviceType: "web",
				progress: 0.3,
				isFinished: false,
			};
			readingProgressFindFirst.mockResolvedValueOnce(existingRecord);

			const updatedRecord = {
				...existingRecord,
				progress: 0.5,
			};
			dbUpdateReturningMock.mockResolvedValueOnce([updatedRecord]);

			const { saveReadingProgressFn } = await import("src/server/reading");

			const result = await saveReadingProgressFn({ data: baseInput });

			expect(result).toEqual(updatedRecord);
			expect(dbUpdateMock).toHaveBeenCalled();
			expect(dbUpdateSetMock).toHaveBeenCalledWith(
				expect.objectContaining({
					progress: 0.5,
					isFinished: false,
				}),
			);
		});

		test("auto-sets isFinished to true when progress >= 1.0", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingProgressFindFirst.mockResolvedValueOnce(null);

			const insertedRecord = {
				id: 1,
				userId: "user-1",
				bookId: 1,
				deviceType: "web",
				progress: 1,
				isFinished: true,
			};
			dbInsertReturningMock.mockResolvedValueOnce([insertedRecord]);

			const { saveReadingProgressFn } = await import("src/server/reading");

			const result = await saveReadingProgressFn({
				data: { ...baseInput, progress: 1.0 },
			});

			expect(result).toEqual(insertedRecord);
			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					progress: 1,
					isFinished: true,
				}),
			);
		});

		test("normalizes progress > 1 to 1 and sets isFinished", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingProgressFindFirst.mockResolvedValueOnce(null);

			const insertedRecord = {
				id: 1,
				userId: "user-1",
				bookId: 1,
				deviceType: "web",
				progress: 1,
				isFinished: true,
			};
			dbInsertReturningMock.mockResolvedValueOnce([insertedRecord]);

			const { saveReadingProgressFn } = await import("src/server/reading");

			const result = await saveReadingProgressFn({
				data: { ...baseInput, progress: 1.5 },
			});

			expect(result).toEqual(insertedRecord);
			// normalizeReadingProgress(1.5) returns 1, and 1 >= 1 triggers isFinished
			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					progress: 1,
					isFinished: true,
				}),
			);
		});

		test("normalizes negative progress to 0", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingProgressFindFirst.mockResolvedValueOnce(null);

			const insertedRecord = {
				id: 1,
				userId: "user-1",
				bookId: 1,
				deviceType: "web",
				progress: 0,
				isFinished: false,
			};
			dbInsertReturningMock.mockResolvedValueOnce([insertedRecord]);

			const { saveReadingProgressFn } = await import("src/server/reading");

			await saveReadingProgressFn({
				data: { ...baseInput, progress: -0.5 },
			});

			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					progress: 0,
					isFinished: false,
				}),
			);
		});

		test("respects explicit isFinished override", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingProgressFindFirst.mockResolvedValueOnce(null);

			const insertedRecord = {
				id: 1,
				userId: "user-1",
				bookId: 1,
				deviceType: "web",
				progress: 0.5,
				isFinished: true,
			};
			dbInsertReturningMock.mockResolvedValueOnce([insertedRecord]);

			const { saveReadingProgressFn } = await import("src/server/reading");

			await saveReadingProgressFn({
				data: { ...baseInput, progress: 0.5, isFinished: true },
			});

			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					progress: 0.5,
					isFinished: true,
				}),
			);
		});

		test("passes optional deviceId and position", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingProgressFindFirst.mockResolvedValueOnce(null);

			dbInsertReturningMock.mockResolvedValueOnce([{ id: 1 }]);

			const { saveReadingProgressFn } = await import("src/server/reading");

			await saveReadingProgressFn({
				data: {
					...baseInput,
					deviceId: "device-abc",
					position: "epubcfi(/6/14)",
				},
			});

			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					deviceId: "device-abc",
					position: "epubcfi(/6/14)",
				}),
			);
		});

		test("propagates error from assertUserCanAccessBook", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { saveReadingProgressFn } = await import("src/server/reading");

			await expect(saveReadingProgressFn({ data: baseInput })).rejects.toThrow(
				"Forbidden",
			);
		});
	});
});
