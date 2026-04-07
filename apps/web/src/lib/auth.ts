import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq, sql } from "drizzle-orm";
import { db } from "src/db";
import { user } from "src/db/schema";

export function getUserCount(): number {
	const result = db.select({ count: sql<number>`count(*)` }).from(user).get();
	return result?.count ?? 0;
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "sqlite",
	}),
	emailAndPassword: {
		enabled: true,
	},
	databaseHooks: {
		user: {
			create: {
				after: async (newUser) => {
					if (getUserCount() === 1) {
						db.update(user)
							.set({ role: "admin" })
							.where(eq(user.id, newUser.id))
							.run();
					}
				},
			},
		},
	},
});
