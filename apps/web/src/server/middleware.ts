import { createServerFn } from "@tanstack/react-start";
import { auth } from "src/lib/auth";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { libraryAccess } from "src/db/schema";

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const request = getRequest();
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return session;
  },
);

type AuthSession = NonNullable<Awaited<ReturnType<typeof getAuthSessionFn>>>;

export async function requireAuth(): Promise<AuthSession> {
  const session = await getAuthSessionFn();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireAuth();
  if (session.user.role !== "admin") {
    throw new Error("Forbidden: admin access required");
  }
  return session;
}

export async function requireLibraryAccess(
  libraryId: number,
): Promise<AuthSession> {
  const session = await requireAuth();
  if (session.user.role === "admin") {
    return session;
  }
  const access = await db.query.libraryAccess.findFirst({
    where: and(
      eq(libraryAccess.userId, session.user.id),
      eq(libraryAccess.libraryId, libraryId),
    ),
  });
  if (!access) {
    throw new Error("Forbidden: no access to this library");
  }
  return session;
}
