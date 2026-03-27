// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "src/db";
import { readingProgress, annotations } from "src/db/schema";
import { requireAuth } from "src/server/middleware";

export const getReadingProgressFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ bookId: z.number().int() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    return db
      .select()
      .from(readingProgress)
      .where(
        and(
          eq(readingProgress.userId, session.user.id),
          eq(readingProgress.bookId, data.bookId),
        ),
      );
  });

export const saveReadingProgressFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        bookId: z.number().int(),
        deviceType: z.enum(["web", "koreader", "kobo"]),
        deviceId: z.string().optional(),
        progress: z.number(),
        position: z.string().optional(),
        isFinished: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    const existing = await db.query.readingProgress.findFirst({
      where: and(
        eq(readingProgress.userId, session.user.id),
        eq(readingProgress.bookId, data.bookId),
        eq(readingProgress.deviceType, data.deviceType),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(readingProgress)
        .set({
          deviceId: data.deviceId,
          progress: data.progress,
          position: data.position,
          isFinished: data.isFinished ?? false,
          updatedAt: new Date(),
        })
        .where(eq(readingProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(readingProgress)
      .values({
        userId: session.user.id,
        bookId: data.bookId,
        deviceType: data.deviceType,
        deviceId: data.deviceId,
        progress: data.progress,
        position: data.position,
        isFinished: data.isFinished ?? false,
      })
      .returning();
    return inserted;
  });

export const getAnnotationsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ bookId: z.number().int() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    return db
      .select()
      .from(annotations)
      .where(
        and(
          eq(annotations.userId, session.user.id),
          eq(annotations.bookId, data.bookId),
        ),
      )
      .orderBy(desc(annotations.createdAt));
  });

export const createAnnotationFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        bookId: z.number().int(),
        type: z.enum(["highlight", "note", "bookmark"]),
        position: z.string().optional(),
        content: z.string().optional(),
        note: z.string().optional(),
        color: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    const [inserted] = await db
      .insert(annotations)
      .values({
        userId: session.user.id,
        bookId: data.bookId,
        type: data.type,
        position: data.position,
        content: data.content,
        note: data.note,
        color: data.color ?? "#facc15",
      })
      .returning();
    return inserted;
  });

export const deleteAnnotationFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
  .handler(async ({ data }) => {
    const session = await requireAuth();

    await db
      .delete(annotations)
      .where(
        and(
          eq(annotations.id, data.id),
          eq(annotations.userId, session.user.id),
        ),
      );
  });
