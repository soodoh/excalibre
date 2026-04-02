import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { db } from "src/db";
import { user } from "src/db/schema";

export const getIsFirstUserFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const result = db.select({ count: sql<number>`count(*)` }).from(user).get();
		return { isFirstUser: (result?.count ?? 0) === 0 };
	},
);
