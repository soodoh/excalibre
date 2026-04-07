import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { account, bookFiles, user } from "src/db/schema";

/**
 * Verifies a username/password pair against the canonical Better Auth user
 * record without creating a session.
 */
export async function verifyStatelessCredentials(
	email: string,
	password: string,
): Promise<typeof user.$inferSelect | null> {
	const normalizedEmail = email.trim().toLowerCase();

	const userRecord = await db.query.user.findFirst({
		where: eq(user.email, normalizedEmail),
	});

	if (!userRecord) {
		return null;
	}

	const credentialAccount = await db.query.account.findFirst({
		where: and(
			eq(account.userId, userRecord.id),
			eq(account.providerId, "credential"),
		),
	});

	if (!credentialAccount?.password) {
		return null;
	}

	const isValid = await verifyPassword({
		hash: credentialAccount.password,
		password,
	});

	return isValid ? userRecord : null;
}

/**
 * Authenticates a KOSync request using x-auth-user (email) and x-auth-key
 * (password) headers. Credential verification is stateless.
 */
export async function authenticateKosync(
	request: Request,
): Promise<typeof user.$inferSelect | null> {
	const email = request.headers.get("x-auth-user");
	const password = request.headers.get("x-auth-key");

	if (!email || !password) {
		return null;
	}

	return verifyStatelessCredentials(email, password);
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
