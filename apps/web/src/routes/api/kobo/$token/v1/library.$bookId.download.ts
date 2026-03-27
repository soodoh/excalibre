import { createFileRoute } from "@tanstack/react-router";
import { db } from "src/db";
import { bookFiles } from "src/db/schema";
import { eq } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import { authenticateKobo } from "src/server/kobo";

const MIME_TYPES: Record<string, string> = {
  epub: "application/epub+zip",
  kepub: "application/epub+zip",
  pdf: "application/pdf",
  mobi: "application/x-mobipocket-ebook",
  azw3: "application/x-mobi8-ebook",
};

export const Route = createFileRoute(
  "/api/kobo/$token/v1/library/$bookId/download",
)({
  server: {
    handlers: {
      GET: async ({
        params,
      }: {
        params: { token: string; bookId: string };
      }) => {
        const auth = await authenticateKobo(params.token);
        if (!auth) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const bookId = Number(params.bookId);
        if (Number.isNaN(bookId)) {
          return Response.json({ error: "Invalid book ID" }, { status: 400 });
        }

        // Get all files for this book
        const files = await db.query.bookFiles.findMany({
          where: eq(bookFiles.bookId, bookId),
        });

        if (files.length === 0) {
          return new Response("Not found", { status: 404 });
        }

        // Prefer EPUB, then kepub, then first available
        const preferred =
          files.find((f) => f.format.toLowerCase() === "epub") ??
          files.find((f) => f.format.toLowerCase() === "kepub") ??
          files[0];

        if (!preferred) {
          return new Response("Not found", { status: 404 });
        }

        if (!existsSync(preferred.filePath)) {
          return new Response("File not found on disk", { status: 404 });
        }

        const contentType =
          MIME_TYPES[preferred.format.toLowerCase()] ??
          "application/octet-stream";

        const data = readFileSync(preferred.filePath);
        return new Response(data, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="book-${String(bookId)}.epub"`,
            "Cache-Control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
