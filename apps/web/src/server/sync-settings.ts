// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { db } from "src/db";
import { koboTokens, opdsKeys } from "src/db/schema";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "src/server/middleware";

// ── Kobo Tokens ───────────────────────────────────────────────────────────────

export const getKoboTokensFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await requireAuth();
    const tokens = await db.query.koboTokens.findMany({
      where: eq(koboTokens.userId, session.user.id),
      columns: { id: true, token: true, deviceName: true, createdAt: true },
    });
    return tokens;
  },
);

export const createKoboTokenFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ deviceName: z.string().optional() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    const token = randomBytes(16).toString("hex");
    const [created] = await db
      .insert(koboTokens)
      .values({
        userId: session.user.id,
        token,
        deviceName: data.deviceName ?? null,
      })
      .returning();
    return created;
  });

export const deleteKoboTokenFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
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

    let key = await db.query.opdsKeys.findFirst({
      where: eq(opdsKeys.userId, session.user.id),
    });

    if (!key) {
      const apiKey = randomBytes(16).toString("hex");
      const [created] = await db
        .insert(opdsKeys)
        .values({ userId: session.user.id, apiKey })
        .returning();
      key = created;
    }

    return key;
  },
);

export const regenerateOpdsKeyFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await requireAuth();

    // Delete existing key(s)
    await db.delete(opdsKeys).where(eq(opdsKeys.userId, session.user.id));

    // Create a new one
    const apiKey = randomBytes(16).toString("hex");
    const [created] = await db
      .insert(opdsKeys)
      .values({ userId: session.user.id, apiKey })
      .returning();

    return created;
  },
);
