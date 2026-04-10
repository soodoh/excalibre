import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
	randomBytes,
	koboTokensFindMany,
	opdsKeysFindFirst,
	dbInsert,
	dbDelete,
	dbUpdate,
	requireAuth,
} = vi.hoisted(() => ({
	randomBytes: vi.fn(),
	koboTokensFindMany: vi.fn(),
	opdsKeysFindFirst: vi.fn(),
	dbInsert: vi.fn(),
	dbDelete: vi.fn(),
	dbUpdate: vi.fn(),
	requireAuth: vi.fn(),
}));

vi.mock("node:crypto", async () => {
	const actual =
		await vi.importActual<typeof import("node:crypto")>("node:crypto");
	return {
		...actual,
		randomBytes,
	};
});

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: unknown) => handler,
		inputValidator: (validator: (raw: unknown) => unknown) => ({
			handler: (handler: (ctx: { data: unknown }) => unknown) => {
				return (ctx: { data: unknown }) => {
					validator(ctx.data);
					return handler(ctx);
				};
			},
		}),
	}),
}));

vi.mock("src/db", () => ({
	db: {
		insert: dbInsert,
		delete: dbDelete,
		update: dbUpdate,
		query: {
			koboTokens: {
				findMany: koboTokensFindMany,
			},
			opdsKeys: {
				findFirst: opdsKeysFindFirst,
			},
		},
	},
}));

vi.mock("src/server/middleware", () => ({
	requireAuth,
}));

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

describe("sync settings secret handling", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		requireAuth.mockResolvedValue({
			user: {
				id: "user-1",
			},
		});
	});

	test("getKoboTokensFn omits raw device tokens from list responses", async () => {
		koboTokensFindMany.mockResolvedValueOnce([
			{
				id: 7,
				tokenPreview: "0011****************************",
				deviceName: "Living Room Kobo",
				createdAt: new Date("2026-04-07T00:00:00.000Z"),
			},
		]);

		const { getKoboTokensFn } = await import("src/server/sync-settings");

		await expect(getKoboTokensFn()).resolves.toEqual([
			{
				id: 7,
				tokenPreview: "0011****************************",
				deviceName: "Living Room Kobo",
				createdAt: new Date("2026-04-07T00:00:00.000Z"),
			},
		]);
	});

	test("createKoboTokenFn stores only a token hash and returns the raw token once", async () => {
		const rawToken = "00112233445566778899aabbccddeeff";
		randomBytes.mockReturnValueOnce(Buffer.from(rawToken, "hex"));
		const valuesSpy = vi.fn(() => ({
			returning: () =>
				Promise.resolve([
					{
						id: 9,
						tokenPreview: "0011****************************",
						deviceName: "Bedroom Kobo",
						createdAt: new Date("2026-04-07T00:00:00.000Z"),
					},
				]),
		}));
		dbInsert.mockReturnValueOnce({
			values: valuesSpy,
		});

		const { createKoboTokenFn } = await import("src/server/sync-settings");

		await expect(
			createKoboTokenFn({ data: { deviceName: "Bedroom Kobo" } }),
		).resolves.toEqual({
			id: 9,
			token: rawToken,
			tokenPreview: "0011****************************",
			deviceName: "Bedroom Kobo",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		});
		expect(valuesSpy).toHaveBeenCalledWith({
			userId: "user-1",
			tokenHash: sha256(rawToken),
			tokenPreview: "0011****************************",
			deviceName: "Bedroom Kobo",
		});
	});

	test("getOpdsKeyFn returns a masked existing key without revealing the raw secret", async () => {
		opdsKeysFindFirst.mockResolvedValueOnce({
			id: 3,
			userId: "user-1",
			apiKeyPreview: "abcd****************************",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		});

		const { getOpdsKeyFn } = await import("src/server/sync-settings");

		await expect(getOpdsKeyFn()).resolves.toEqual({
			id: 3,
			apiKey: "abcd****************************",
			rawApiKey: undefined,
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		});
	});

	test("getOpdsKeyFn creates a hashed key and returns the raw value once when none exists", async () => {
		const rawApiKey = "fedcba98765432100123456789abcdef";
		randomBytes.mockReturnValueOnce(Buffer.from(rawApiKey, "hex"));
		opdsKeysFindFirst.mockResolvedValueOnce(null);
		const valuesSpy = vi.fn(() => ({
			returning: () =>
				Promise.resolve([
					{
						id: 11,
						userId: "user-1",
						apiKeyPreview: "fedc****************************",
						createdAt: new Date("2026-04-07T00:00:00.000Z"),
					},
				]),
		}));
		dbInsert.mockReturnValueOnce({
			values: valuesSpy,
		});

		const { getOpdsKeyFn } = await import("src/server/sync-settings");

		await expect(getOpdsKeyFn()).resolves.toEqual({
			id: 11,
			apiKey: "fedc****************************",
			rawApiKey,
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		});
		expect(valuesSpy).toHaveBeenCalledWith({
			userId: "user-1",
			apiKeyHash: sha256(rawApiKey),
			apiKeyPreview: "fedc****************************",
		});
	});

	test("deleteKoboTokenFn deletes a token scoped to the current user", async () => {
		const deleteWhere = vi.fn(() => Promise.resolve());
		dbDelete.mockReturnValueOnce({
			where: deleteWhere,
		});

		const { deleteKoboTokenFn } = await import("src/server/sync-settings");

		await expect(deleteKoboTokenFn({ data: { id: 7 } })).resolves.toEqual({
			success: true,
		});
		expect(deleteWhere).toHaveBeenCalled();
		expect(requireAuth).toHaveBeenCalled();
	});

	test("createKoboTokenFn defaults deviceName to null when not provided", async () => {
		const rawToken = "aabbccddeeff00112233445566778899";
		randomBytes.mockReturnValueOnce(Buffer.from(rawToken, "hex"));
		const valuesSpy = vi.fn(() => ({
			returning: () =>
				Promise.resolve([
					{
						id: 10,
						tokenPreview: "aabb****************************",
						deviceName: null,
						createdAt: new Date("2026-04-07T00:00:00.000Z"),
					},
				]),
		}));
		dbInsert.mockReturnValueOnce({
			values: valuesSpy,
		});

		const { createKoboTokenFn } = await import("src/server/sync-settings");

		await expect(createKoboTokenFn({ data: {} })).resolves.toEqual({
			id: 10,
			token: rawToken,
			tokenPreview: "aabb****************************",
			deviceName: null,
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		});
		expect(valuesSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				deviceName: null,
			}),
		);
	});

	test("regenerateOpdsKeyFn rotates the stored hash and returns the new raw key once", async () => {
		const rawApiKey = "0123456789abcdeffedcba9876543210";
		randomBytes.mockReturnValueOnce(Buffer.from(rawApiKey, "hex"));
		const deleteWhere = vi.fn(() => Promise.resolve());
		dbDelete.mockReturnValueOnce({
			where: deleteWhere,
		});
		const valuesSpy = vi.fn(() => ({
			returning: () =>
				Promise.resolve([
					{
						id: 15,
						userId: "user-1",
						apiKeyPreview: "0123****************************",
						createdAt: new Date("2026-04-07T00:00:00.000Z"),
					},
				]),
		}));
		dbInsert.mockReturnValueOnce({
			values: valuesSpy,
		});

		const { regenerateOpdsKeyFn } = await import("src/server/sync-settings");

		await expect(regenerateOpdsKeyFn()).resolves.toEqual({
			id: 15,
			apiKey: "0123****************************",
			rawApiKey,
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
		});
		expect(deleteWhere).toHaveBeenCalled();
		expect(valuesSpy).toHaveBeenCalledWith({
			userId: "user-1",
			apiKeyHash: sha256(rawApiKey),
			apiKeyPreview: "0123****************************",
		});
	});
});
