// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument

import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { koboTokens, opdsKeys } from "src/db/schema";
import { requireAuth } from "src/server/middleware";
import { hashSecret, maskSecret } from "src/server/secret-tokens";
import { z } from "zod";

// ── Kobo Tokens ───────────────────────────────────────────────────────────────

export const getKoboTokensFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await requireAuth();
		const tokens = await db.query.koboTokens.findMany({
			where: eq(koboTokens.userId, session.user.id),
			columns: {
				id: true,
				tokenPreview: true,
				deviceName: true,
				createdAt: true,
			},
		});
		return tokens;
	},
);

export const createKoboTokenFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) =>
		z.object({ deviceName: z.string().optional() }).parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		const token = randomBytes(16).toString("hex");
		const tokenHash = hashSecret(token);
		const tokenPreview = maskSecret(token);
		const [created] = await db
			.insert(koboTokens)
			.values({
				userId: session.user.id,
				tokenHash,
				tokenPreview,
				deviceName: data.deviceName ?? null,
			})
			.returning();
		return {
			id: created.id,
			token,
			tokenPreview: created.tokenPreview,
			deviceName: created.deviceName,
			createdAt: created.createdAt,
		};
	});

export const deleteKoboTokenFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) =>
		z.object({ id: z.number().int() }).parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		await db
			.delete(koboTokens)
			.where(
				and(eq(koboTokens.id, data.id), eq(koboTokens.userId, session.user.id)),
			);
		return { success: true };
	});

// ── OPDS Keys ─────────────────────────────────────────────────────────────────

export const getOpdsKeyFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await requireAuth();

		const key = await db.query.opdsKeys.findFirst({
			where: eq(opdsKeys.userId, session.user.id),
		});

		if (!key) {
			const rawApiKey = randomBytes(16).toString("hex");
			const apiKeyPreview = maskSecret(rawApiKey);
			const [created] = await db
				.insert(opdsKeys)
				.values({
					userId: session.user.id,
					apiKeyHash: hashSecret(rawApiKey),
					apiKeyPreview,
				})
				.returning();
			return {
				id: created.id,
				apiKey: created.apiKeyPreview,
				rawApiKey,
				createdAt: created.createdAt,
			};
		}

		return {
			id: key.id,
			apiKey: key.apiKeyPreview,
			rawApiKey: undefined,
			createdAt: key.createdAt,
		};
	},
);

export const regenerateOpdsKeyFn = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await requireAuth();

		// Delete existing key(s)
		await db.delete(opdsKeys).where(eq(opdsKeys.userId, session.user.id));

		// Create a new one
		const rawApiKey = randomBytes(16).toString("hex");
		const apiKeyPreview = maskSecret(rawApiKey);
		const [created] = await db
			.insert(opdsKeys)
			.values({
				userId: session.user.id,
				apiKeyHash: hashSecret(rawApiKey),
				apiKeyPreview,
			})
			.returning();

		return {
			id: created.id,
			apiKey: created.apiKeyPreview,
			rawApiKey,
			createdAt: created.createdAt,
		};
	},
);
