import { eq } from "drizzle-orm";
import { db } from "src/db";
import { bookFiles, user } from "src/db/schema";

/**
 * Authenticates a KOSync request using x-auth-user (email) and x-auth-key
 * (password) headers. We verify credentials by calling better-auth's
 * sign-in endpoint internally. Returns the user record on success, or null
 * on failure.
 */
export async function authenticateKosync(
	request: Request,
): Promise<typeof user.$inferSelect | null> {
	const email = request.headers.get("x-auth-user");
	const password = request.headers.get("x-auth-key");

	if (!email || !password) {
		return null;
	}

	// Verify credentials via better-auth's sign-in endpoint
	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;

	try {
		const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});

		if (!response.ok) {
			return null;
		}
	} catch {
		return null;
	}

	// Fetch and return the user record
	const userRecord = await db.query.user.findFirst({
		where: eq(user.email, email),
	});

	return userRecord ?? null;
}

/**
 * Finds a book file record by its MD5 hash. Returns the first matching
 * record or null.
 */
export async function findBookByMd5(
	md5Hash: string,
): Promise<typeof bookFiles.$inferSelect | null> {
	const record = await db.query.bookFiles.findFirst({
		where: eq(bookFiles.md5Hash, md5Hash),
	});

	return record ?? null;
}
