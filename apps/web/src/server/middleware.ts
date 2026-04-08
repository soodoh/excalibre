import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "src/db";
import { user } from "src/db/schema";
import { auth } from "src/lib/auth";
import { assertUserCanAccessLibrary } from "src/server/access-control";
import { ForbiddenError, UnauthorizedError } from "src/server/http-errors";

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session) {
			return null;
		}

		const userRecord = await db.query.user.findFirst({
			where: eq(user.id, session.user.id),
			columns: { role: true },
		});

		return {
			...session,
			user: {
				...session.user,
				role: userRecord?.role ?? "user",
			},
		};
	},
);

type AuthSession = NonNullable<Awaited<ReturnType<typeof getAuthSessionFn>>>;

export async function requireAuth(): Promise<AuthSession> {
	const session = await getAuthSessionFn();
	if (!session) {
		throw new UnauthorizedError();
	}
	return session;
}

export async function requireAdmin(): Promise<AuthSession> {
	const session = await requireAuth();
	if (session.user.role !== "admin") {
		throw new ForbiddenError("Forbidden: admin access required");
	}
	return session;
}

export async function requireLibraryAccess(
	libraryId: number,
): Promise<AuthSession> {
	const session = await requireAuth();
	await assertUserCanAccessLibrary(
		session.user.id,
		libraryId,
		session.user.role,
	);
	return session;
}
