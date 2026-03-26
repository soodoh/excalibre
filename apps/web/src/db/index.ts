import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_URL ?? "data/sqlite.db");
sqlite.run(`PRAGMA journal_mode = ${process.env.SQLITE_JOURNAL_MODE ?? "WAL"}`);
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle({ client: sqlite, schema });
