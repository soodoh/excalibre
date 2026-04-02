import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const koboTokens = sqliteTable("kobo_tokens", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	token: text("token").notNull().unique(),
	deviceName: text("device_name"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const opdsKeys = sqliteTable("opds_keys", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	apiKey: text("api_key").notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});
