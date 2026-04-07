import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { account, bookFiles, user } from "src/db/schema";

export const DUMMY_PASSWORD_HASH =
	"ed8eeaec39fb19074f3bad603b89960b:97183ad847dde8b136b6b5b1ba9b23190b5e9751e1debcc22e127263fac45d0cf00ced2681b44caa9a315b9b2207069e929130e7253cdfe88fadea1f58304a64";

/**
 * Verifies a username/password pair against the canonical Better Auth user
 * record without creating a session.
 */
export async function verifyStatelessCredentials(
	email: string,
	password: string,
): Promise<typeof user.$inferSelect | null> {
	const normalizedEmail = email.trim().toLowerCase();

	const userRecord = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image,
			role: user.role,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			credentialPassword: account.password,
		})
		.from(user)
		.leftJoin(
			account,
			and(eq(user.id, account.userId), eq(account.providerId, "credential")),
		)
		.where(eq(user.email, normalizedEmail))
		.get();

	const passwordHash = userRecord?.credentialPassword ?? DUMMY_PASSWORD_HASH;
	const isValid = await verifyPassword({ hash: passwordHash, password });

	if (!isValid || !userRecord || !userRecord.credentialPassword) {
		return null;
	}

	return {
		id: userRecord.id,
		name: userRecord.name,
		email: userRecord.email,
		emailVerified: userRecord.emailVerified,
		image: userRecord.image,
		role: userRecord.role,
		createdAt: userRecord.createdAt,
		updatedAt: userRecord.updatedAt,
	};
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
