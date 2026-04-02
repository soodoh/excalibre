import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { books } from "./books";

export const shelves = sqliteTable("shelves", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	type: text("type", { enum: ["smart", "manual"] })
		.notNull()
		.default("manual"),
	filterRules: text("filter_rules", { mode: "json" }).$type<
		Record<string, unknown>
	>(),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const shelvesBooks = sqliteTable(
	"shelves_books",
	{
		shelfId: integer("shelf_id")
			.notNull()
			.references(() => shelves.id, { onDelete: "cascade" }),
		bookId: integer("book_id")
			.notNull()
			.references(() => books.id, { onDelete: "cascade" }),
	},
	(t) => [unique().on(t.shelfId, t.bookId)],
);

export const collections = sqliteTable("collections", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	coverImage: text("cover_image"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const collectionsBooks = sqliteTable(
	"collections_books",
	{
		collectionId: integer("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		bookId: integer("book_id")
			.notNull()
			.references(() => books.id, { onDelete: "cascade" }),
	},
	(t) => [unique().on(t.collectionId, t.bookId)],
);

export const readingLists = sqliteTable("reading_lists", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const readingListBooks = sqliteTable(
	"reading_list_books",
	{
		readingListId: integer("reading_list_id")
			.notNull()
			.references(() => readingLists.id, { onDelete: "cascade" }),
		bookId: integer("book_id")
			.notNull()
			.references(() => books.id, { onDelete: "cascade" }),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(t) => [unique().on(t.readingListId, t.bookId)],
);
