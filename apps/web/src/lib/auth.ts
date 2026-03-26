import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "src/db";
import { user } from "src/db/schema";
import { eq, sql } from "drizzle-orm";

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
          const result = db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .get();
          if ((result?.count ?? 0) === 1) {
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
