import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

const eqMock = vi.fn((field: unknown, value: unknown) => ({ field, value }));
const koboTokensFindFirst = vi.fn();
const dbUpdate = vi.fn();

vi.mock("drizzle-orm", () => ({
	eq: eqMock,
}));

vi.mock("src/db", () => ({
	db: {
		update: dbUpdate,
		query: {
			koboTokens: {
				findFirst: koboTokensFindFirst,
			},
		},
	},
}));

describe("authenticateKobo", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("hashes the incoming Kobo token before lookup", async () => {
		koboTokensFindFirst.mockResolvedValueOnce({
			userId: "user-1",
		});

		const { authenticateKobo } = await import("src/server/kobo");

		await expect(authenticateKobo("kobo-secret")).resolves.toEqual({
			userId: "user-1",
		});
		expect(eqMock).toHaveBeenCalledWith(
			expect.anything(),
			createHash("sha256").update("kobo-secret").digest("hex"),
		);
	});

	test("upgrades a legacy plaintext Kobo token to a hash after authenticating", async () => {
		const setMock = vi.fn(() => ({
			where: vi.fn(() => Promise.resolve()),
		}));
		dbUpdate.mockReturnValue({
			set: setMock,
		});
		koboTokensFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: 9,
			userId: "user-1",
		});

		const { authenticateKobo } = await import("src/server/kobo");

		await expect(authenticateKobo("legacy-token")).resolves.toEqual({
			userId: "user-1",
		});
		expect(koboTokensFindFirst).toHaveBeenCalledTimes(2);
		expect(setMock).toHaveBeenCalledWith({
			tokenHash: createHash("sha256").update("legacy-token").digest("hex"),
			tokenPreview: "lega********",
		});
	});

	test("returns null when both hash and plaintext lookups fail", async () => {
		koboTokensFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

		const { authenticateKobo } = await import("src/server/kobo");

		await expect(authenticateKobo("unknown-token")).resolves.toBeNull();
		expect(koboTokensFindFirst).toHaveBeenCalledTimes(2);
	});

	test("upgrades legacy token with existing tokenPreview", async () => {
		const setMock = vi.fn(() => ({
			where: vi.fn(() => Promise.resolve()),
		}));
		dbUpdate.mockReturnValue({
			set: setMock,
		});
		koboTokensFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: 10,
			userId: "user-1",
			tokenPreview: "existing-preview",
		});

		const { authenticateKobo } = await import("src/server/kobo");

		await expect(authenticateKobo("legacy-tok")).resolves.toEqual({
			userId: "user-1",
		});
		expect(setMock).toHaveBeenCalledWith({
			tokenHash: createHash("sha256").update("legacy-tok").digest("hex"),
			tokenPreview: "existing-preview",
		});
	});
});
