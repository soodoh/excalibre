import { beforeEach, describe, expect, test, vi } from "vitest";

// --- Mock setup ---
const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectGetMock = vi.fn();

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: unknown) => handler,
		inputValidator: () => ({
			handler: (handler: unknown) => handler,
		}),
	}),
}));

vi.mock("drizzle-orm", () => ({
	sql: vi.fn(() => "count_sql_expr"),
}));

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
	},
}));

vi.mock("src/db/schema", () => ({
	user: { id: "user.id" },
}));

describe("auth server functions", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		const selectChain = {
			from: dbSelectFromMock,
		};
		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue({ get: dbSelectGetMock });
	});

	describe("getIsFirstUserFn", () => {
		test("returns isFirstUser true when no users exist", async () => {
			dbSelectGetMock.mockReturnValue({ count: 0 });

			const { getIsFirstUserFn } = await import("src/server/auth");

			const result = await getIsFirstUserFn({});

			expect(result).toEqual({ isFirstUser: true });
		});

		test("returns isFirstUser false when users exist", async () => {
			dbSelectGetMock.mockReturnValue({ count: 3 });

			const { getIsFirstUserFn } = await import("src/server/auth");

			const result = await getIsFirstUserFn({});

			expect(result).toEqual({ isFirstUser: false });
		});

		test("returns isFirstUser true when result is null", async () => {
			dbSelectGetMock.mockReturnValue(null);

			const { getIsFirstUserFn } = await import("src/server/auth");

			const result = await getIsFirstUserFn({});

			expect(result).toEqual({ isFirstUser: true });
		});

		test("returns isFirstUser true when result is undefined", async () => {
			dbSelectGetMock.mockReturnValue(undefined);

			const { getIsFirstUserFn } = await import("src/server/auth");

			const result = await getIsFirstUserFn({});

			expect(result).toEqual({ isFirstUser: true });
		});
	});
});
