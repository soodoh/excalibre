import { beforeEach, describe, expect, test, vi } from "vitest";

const { dbSelectMock, dbSelectFromMock, dbSelectGetMock } = vi.hoisted(() => ({
	dbSelectMock: vi.fn(),
	dbSelectFromMock: vi.fn(),
	dbSelectGetMock: vi.fn(),
}));

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

import { getIsFirstUserFn } from "./auth";

describe("getIsFirstUserFn", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		dbSelectMock.mockReturnValue({ from: dbSelectFromMock });
		dbSelectFromMock.mockReturnValue({ get: dbSelectGetMock });
	});

	test("returns isFirstUser true when no users exist", async () => {
		dbSelectGetMock.mockReturnValue({ count: 0 });
		const result = await getIsFirstUserFn({});
		expect(result).toEqual({ isFirstUser: true });
	});

	test("returns isFirstUser false when users exist", async () => {
		dbSelectGetMock.mockReturnValue({ count: 3 });
		const result = await getIsFirstUserFn({});
		expect(result).toEqual({ isFirstUser: false });
	});

	test("returns isFirstUser true when result is null", async () => {
		dbSelectGetMock.mockReturnValue(null);
		const result = await getIsFirstUserFn({});
		expect(result).toEqual({ isFirstUser: true });
	});

	test("returns isFirstUser true when result is undefined", async () => {
		dbSelectGetMock.mockReturnValue(undefined);
		const result = await getIsFirstUserFn({});
		expect(result).toEqual({ isFirstUser: true });
	});
});
