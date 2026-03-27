import { createFileRoute } from "@tanstack/react-router";
import { db } from "src/db";
import { books } from "src/db/schema";
import { eq } from "drizzle-orm";
import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const Route = createFileRoute("/api/covers/$bookId")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { bookId: string } }) => {
        const bookId = Number(params.bookId);
        if (Number.isNaN(bookId)) {
          return new Response("Invalid book ID", { status: 400 });
        }

        const book = await db.query.books.findFirst({
          where: eq(books.id, bookId),
          columns: { coverPath: true },
        });

        if (!book || !book.coverPath) {
          return new Response("Not found", { status: 404 });
        }

        if (!existsSync(book.coverPath)) {
          return new Response("Not found", { status: 404 });
        }

        const ext = extname(book.coverPath).toLowerCase();
        const contentType = MIME_TYPES[ext] ?? "image/jpeg";

        const data = readFileSync(book.coverPath);
        return new Response(data, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
