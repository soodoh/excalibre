import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { account, bookFiles, user } from "src/db/schema";

export const DUMMY_PASSWORD_HASH =
	"ed8eeaec39fb19074f3bad603b89960b:97183ad847dde8b136b6b5b1ba9b23190b5e9751e1debcc22e127263fac45d0cf00ced2681b44caa9a315b9b2207069e929130e7253cdfe88fadea1f58304a64";

async function burnPasswordVerificationWork(password: string): Promise<void> {
	await verifyPassword({
		hash: DUMMY_PASSWORD_HASH,
		password,
	});
}

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
		await burnPasswordVerificationWork(password);
		return null;
	}

	const credentialAccount = await db.query.account.findFirst({
		where: and(
			eq(account.userId, userRecord.id),
			eq(account.providerId, "credential"),
		),
	});

	if (!credentialAccount?.password) {
		await burnPasswordVerificationWork(password);
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
