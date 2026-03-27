// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "src/db";
import { libraries, libraryAccess } from "src/db/schema";
import { requireAdmin, requireAuth } from "src/server/middleware";
import { createLibrarySchema, updateLibrarySchema } from "src/lib/validators";
import type {
  CreateLibraryInput,
  UpdateLibraryInput,
} from "src/lib/validators";

export const getLibrariesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await requireAuth();

    if (session.user.role === "admin") {
      return db.select().from(libraries);
    }

    const access = await db
      .select({ libraryId: libraryAccess.libraryId })
      .from(libraryAccess)
      .where(eq(libraryAccess.userId, session.user.id));

    if (access.length === 0) {
      return [];
    }

    const libraryIds = access.map((a) => a.libraryId);
    return db.select().from(libraries).where(inArray(libraries.id, libraryIds));
  },
);

export const getLibraryFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
  .handler(async ({ data }) => {
    await requireAuth();

    const library = await db.query.libraries.findFirst({
      where: eq(libraries.id, data.id),
    });

    if (!library) {
      throw new Error("Library not found");
    }

    return library;
  });

export const createLibraryFn = createServerFn({ method: "POST" })
  .validator(
    (raw: unknown): CreateLibraryInput => createLibrarySchema.parse(raw),
  )
  .handler(async ({ data }) => {
    await requireAdmin();

    const [library] = await db
      .insert(libraries)
      .values({
        name: data.name,
        type: data.type,
        scanPaths: data.scanPaths,
        scanInterval: data.scanInterval,
      })
      .returning();

    return library;
  });

export const updateLibraryFn = createServerFn({ method: "POST" })
  .validator(
    (raw: unknown): UpdateLibraryInput => updateLibrarySchema.parse(raw),
  )
  .handler(async ({ data }) => {
    await requireAdmin();

    const { id, ...rest } = data;

    const [library] = await db
      .update(libraries)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(libraries.id, id))
      .returning();

    if (!library) {
      throw new Error("Library not found");
    }

    return library;
  });

export const deleteLibraryFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();

    await db.delete(libraries).where(eq(libraries.id, data.id));

    return { success: true };
  });
