import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { books } from "./books";

export const readingProgress = sqliteTable("reading_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  deviceType: text("device_type", { enum: ["web", "koreader", "kobo"] })
    .notNull()
    .default("web"),
  deviceId: text("device_id"),
  progress: real("progress").notNull().default(0),
  position: text("position"),
  isFinished: integer("is_finished", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const annotations = sqliteTable("annotations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["highlight", "note", "bookmark"] })
    .notNull()
    .default("highlight"),
  position: text("position"),
  content: text("content"),
  note: text("note"),
  color: text("color"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
