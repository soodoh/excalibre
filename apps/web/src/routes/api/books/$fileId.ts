import { existsSync, readFileSync } from "node:fs";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "src/db";
import { bookFiles } from "src/db/schema";

const MIME_TYPES: Record<string, string> = {
	epub: "application/epub+zip",
	pdf: "application/pdf",
	mobi: "application/x-mobipocket-ebook",
	azw3: "application/x-mobi8-ebook",
	cbz: "application/x-cbz",
	fb2: "application/x-fictionbook+xml",
};

export const Route = createFileRoute("/api/books/$fileId")({
	server: {
		handlers: {
			GET: async ({ params }: { params: { fileId: string } }) => {
				const fileId = Number(params.fileId);
				if (Number.isNaN(fileId)) {
					return new Response("Invalid file ID", { status: 400 });
				}

				const file = await db.query.bookFiles.findFirst({
					where: eq(bookFiles.id, fileId),
					columns: { filePath: true, format: true },
				});

				if (!file) {
					return new Response("Not found", { status: 404 });
				}

				if (!existsSync(file.filePath)) {
					return new Response("Not found", { status: 404 });
				}

				const contentType =
					MIME_TYPES[file.format.toLowerCase()] ?? "application/octet-stream";

				const data = readFileSync(file.filePath);
				return new Response(data, {
					status: 200,
					headers: {
						"Content-Type": contentType,
						"Cache-Control": "private, max-age=3600",
					},
				});
			},
		},
	},
});
