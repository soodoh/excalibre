import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAuth = vi.fn();
const requireAdmin = vi.fn();
const assertUserCanAccessBook = vi.fn();
const assertUserCanAccessBookFile = vi.fn();

const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectWhereMock = vi.fn();
const dbSelectOrderByMock = vi.fn();
const dbSelectLimitMock = vi.fn();
const dbInsertMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertReturningMock = vi.fn();

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: unknown) => handler,
		inputValidator: () => ({
			handler: (handler: unknown) => handler,
		}),
	}),
}));

vi.mock("drizzle-orm", () => {
	const sqlTaggedTemplate = (
		strings: TemplateStringsArray,
		...values: unknown[]
	) => ({
		strings,
		values,
	});
	return {
		and: vi.fn((...clauses: unknown[]) => ({ clauses })),
		count: vi.fn(() => "count_expr"),
		desc: vi.fn((col: unknown) => ({ desc: col })),
		eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
		inArray: vi.fn((field: unknown, values: unknown) => ({ field, values })),
		sql: sqlTaggedTemplate,
	};
});

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
		insert: dbInsertMock,
	},
}));

vi.mock("src/db/schema", () => ({
	bookFiles: { id: "bookFiles.id", bookId: "bookFiles.bookId" },
	jobs: {
		payload: "jobs.payload",
		createdAt: "jobs.createdAt",
	},
}));

vi.mock("src/server/middleware", () => ({
	requireAuth,
	requireAdmin,
}));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessBook,
	assertUserCanAccessBookFile,
}));

vi.mock("src/server/conversion-options", () => ({
	getSupportedConversions: vi.fn((format: string) => {
		if (format === "epub")
			return ["kepub", "mobi", "pdf", "docx", "html", "txt"];
		if (format === "mobi") return ["epub", "pdf", "docx", "html", "txt"];
		return [];
	}),
}));

const selectChain = {
	from: dbSelectFromMock,
	where: dbSelectWhereMock,
	orderBy: dbSelectOrderByMock,
	limit: dbSelectLimitMock,
};

const insertChain = {
	values: dbInsertValuesMock,
	returning: dbInsertReturningMock,
};

describe("conversion server functions", () => {
	const mockSession = {
		user: { id: "user-1", role: "user" },
	};

	const mockAdminSession = {
		user: { id: "admin-1", role: "admin" },
	};

	beforeEach(() => {
		vi.clearAllMocks();

		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);
		dbSelectWhereMock.mockReturnValue(selectChain);
		dbSelectOrderByMock.mockReturnValue(selectChain);
		dbSelectLimitMock.mockReturnValue(selectChain);

		dbInsertMock.mockReturnValue(insertChain);
		dbInsertValuesMock.mockReturnValue(insertChain);
		dbInsertReturningMock.mockResolvedValue([]);
	});

	describe("requestConversionFn", () => {
		test("creates a conversion job for a valid format", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBookFile.mockResolvedValueOnce({
				id: 10,
				bookId: 1,
				format: "epub",
				filePath: "/books/dune.epub",
			});

			const mockJob = {
				id: 1,
				type: "convert",
				status: "pending",
				payload: { bookFileId: 10, targetFormat: "pdf" },
			};
			dbInsertReturningMock.mockResolvedValueOnce([mockJob]);

			const { requestConversionFn } = await import("src/server/conversion");

			const result = await requestConversionFn({
				data: { bookFileId: 10, targetFormat: "pdf" },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBookFile).toHaveBeenCalledWith(
				"user-1",
				10,
				"user",
			);
			expect(dbInsertMock).toHaveBeenCalled();
			expect(result).toEqual(mockJob);
		});

		test("throws for unsupported target format", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBookFile.mockResolvedValueOnce({
				id: 10,
				bookId: 1,
				format: "epub",
				filePath: "/books/dune.epub",
			});

			const { requestConversionFn } = await import("src/server/conversion");

			await expect(
				requestConversionFn({
					data: { bookFileId: 10, targetFormat: "mp3" },
				}),
			).rejects.toThrow("Cannot convert epub to mp3");
		});

		test("lowercases target format before checking support", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBookFile.mockResolvedValueOnce({
				id: 10,
				bookId: 1,
				format: "epub",
				filePath: "/books/dune.epub",
			});

			const mockJob = {
				id: 2,
				type: "convert",
				status: "pending",
				payload: { bookFileId: 10, targetFormat: "pdf" },
			};
			dbInsertReturningMock.mockResolvedValueOnce([mockJob]);

			const { requestConversionFn } = await import("src/server/conversion");

			const result = await requestConversionFn({
				data: { bookFileId: 10, targetFormat: "PDF" },
			});

			expect(result).toEqual(mockJob);
		});

		test("propagates error from requireAuth", async () => {
			requireAuth.mockRejectedValueOnce(new Error("Unauthorized"));

			const { requestConversionFn } = await import("src/server/conversion");

			await expect(
				requestConversionFn({
					data: { bookFileId: 10, targetFormat: "pdf" },
				}),
			).rejects.toThrow("Unauthorized");
		});

		test("propagates error from assertUserCanAccessBookFile", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBookFile.mockRejectedValueOnce(
				new Error("Book file not found"),
			);

			const { requestConversionFn } = await import("src/server/conversion");

			await expect(
				requestConversionFn({
					data: { bookFileId: 999, targetFormat: "pdf" },
				}),
			).rejects.toThrow("Book file not found");
		});
	});

	describe("getSupportedConversionsFn", () => {
		test("returns supported conversions for a format", async () => {
			const { getSupportedConversionsFn } = await import(
				"src/server/conversion"
			);

			const result = await getSupportedConversionsFn({
				data: { format: "epub" },
			});

			expect(result).toEqual(["kepub", "mobi", "pdf", "docx", "html", "txt"]);
		});

		test("returns empty array for unknown format", async () => {
			const { getSupportedConversionsFn } = await import(
				"src/server/conversion"
			);

			const result = await getSupportedConversionsFn({
				data: { format: "xyz" },
			});

			expect(result).toEqual([]);
		});
	});

	describe("getJobsForBookFn", () => {
		test("returns jobs for an accessible book", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			// Files query
			dbSelectWhereMock.mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);

			// Jobs query
			const mockJobs = [
				{
					id: 1,
					type: "convert",
					status: "completed",
					payload: { bookFileId: 10, targetFormat: "pdf" },
				},
			];
			dbSelectLimitMock.mockResolvedValueOnce(mockJobs);

			const { getJobsForBookFn } = await import("src/server/conversion");

			const result = await getJobsForBookFn({ data: { bookId: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith("user-1", 1, "user");
			expect(result).toEqual(mockJobs);
		});

		test("returns empty array when book has no files", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			// Files query returns empty
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getJobsForBookFn } = await import("src/server/conversion");

			const result = await getJobsForBookFn({ data: { bookId: 1 } });

			expect(result).toEqual([]);
		});

		test("propagates error from assertUserCanAccessBook", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { getJobsForBookFn } = await import("src/server/conversion");

			await expect(getJobsForBookFn({ data: { bookId: 999 } })).rejects.toThrow(
				"Forbidden",
			);
		});
	});

	describe("getRecentJobsFn", () => {
		test("returns recent jobs for admin", async () => {
			requireAdmin.mockResolvedValueOnce(mockAdminSession);

			const mockJobs = [
				{ id: 1, type: "convert", status: "completed" },
				{ id: 2, type: "scan", status: "pending" },
			];
			dbSelectLimitMock.mockResolvedValueOnce(mockJobs);

			const { getRecentJobsFn } = await import("src/server/conversion");

			const result = await getRecentJobsFn({});

			expect(requireAdmin).toHaveBeenCalled();
			expect(result).toEqual(mockJobs);
		});

		test("propagates error from requireAdmin", async () => {
			requireAdmin.mockRejectedValueOnce(
				new Error("Forbidden: admin access required"),
			);

			const { getRecentJobsFn } = await import("src/server/conversion");

			await expect(getRecentJobsFn({})).rejects.toThrow(
				"Forbidden: admin access required",
			);
		});
	});
});
