import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	type: text("type", { enum: ["scan", "convert", "epub_fix"] }).notNull(),
	status: text("status", {
		enum: ["pending", "running", "completed", "failed"],
	})
		.notNull()
		.default("pending"),
	// biome-ignore lint/complexity/noBannedTypes: Required for current Drizzle JSON column inference.
	payload: text("payload", { mode: "json" }).$type<Record<string, {}>>(),
	// biome-ignore lint/complexity/noBannedTypes: Required for current Drizzle JSON column inference.
	result: text("result", { mode: "json" }).$type<Record<string, {}>>(),
	error: text("error"),
	priority: integer("priority").notNull().default(0),
	attempts: integer("attempts").notNull().default(0),
	maxAttempts: integer("max_attempts").notNull().default(3),
	scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
	startedAt: integer("started_at", { mode: "timestamp" }),
	completedAt: integer("completed_at", { mode: "timestamp" }),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});
