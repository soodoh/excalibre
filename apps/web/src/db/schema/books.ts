import {
  sqliteTable,
  text,
  integer,
  real,
  unique,
} from "drizzle-orm/sqlite-core";
import { libraries } from "./libraries";

export const series = sqliteTable("series", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortName: text("sort_name").notNull(),
  libraryId: integer("library_id")
    .notNull()
    .references(() => libraries.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const authors = sqliteTable("authors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortName: text("sort_name").notNull(),
  slug: text("slug"),
  bio: text("bio"),
  coverPath: text("cover_path"),
  hardcoverId: text("hardcover_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  sortTitle: text("sort_title").notNull(),
  slug: text("slug"),
  libraryId: integer("library_id")
    .notNull()
    .references(() => libraries.id, { onDelete: "cascade" }),
  description: text("description"),
  language: text("language"),
  publisher: text("publisher"),
  publishDate: text("publish_date"),
  isbn10: text("isbn10"),
  isbn13: text("isbn13"),
  pageCount: integer("page_count"),
  coverPath: text("cover_path"),
  hardcoverId: text("hardcover_id"),
  googleBooksId: text("google_books_id"),
  seriesId: integer("series_id").references(() => series.id, {
    onDelete: "set null",
  }),
  seriesIndex: real("series_index"),
  rating: real("rating"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const booksAuthors = sqliteTable(
  "books_authors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["author", "editor", "translator", "illustrator"],
    })
      .notNull()
      .default("author"),
  },
  (t) => [unique().on(t.bookId, t.authorId, t.role)],
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const booksTags = sqliteTable(
  "books_tags",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.bookId, t.tagId)],
);

export const bookFiles = sqliteTable("book_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  format: text("format").notNull(),
  fileSize: integer("file_size"),
  fileHash: text("file_hash"),
  md5Hash: text("md5_hash"),
  source: text("source", { enum: ["scanned", "uploaded", "converted"] })
    .notNull()
    .default("scanned"),
  volumeType: text("volume_type", { enum: ["data", "excalibre"] })
    .notNull()
    .default("data"),
  discoveredAt: integer("discovered_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  modifiedAt: integer("modified_at", { mode: "timestamp" }),
});
