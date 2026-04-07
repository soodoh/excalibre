import { existsSync } from "node:fs";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import AdmZip from "adm-zip";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { bookFiles } from "src/db/schema";
import { assertUserCanAccessBook } from "src/server/access-control";
import { responseFromHttpError } from "src/server/http-errors";
import { authenticateOpds } from "src/server/opds";

const IMAGE_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"bmp",
	"tiff",
]);

function getImageMimeType(ext: string): string {
	const map: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		bmp: "image/bmp",
		tiff: "image/tiff",
	};
	return map[ext.toLowerCase()] ?? "image/jpeg";
}

export async function handleOpdsPseRequest({
	request,
	params,
}: {
	request: Request;
	params: { bookId: string; pageNumber: string };
}): Promise<Response> {
	try {
		const auth = await authenticateOpds(request);
		if (!auth) {
			return new Response("Unauthorized", {
				status: 401,
				headers: { "WWW-Authenticate": 'Basic realm="Excalibre OPDS"' },
			});
		}

		const bookId = Number(params.bookId);
		const pageNumber = Number(params.pageNumber);

		if (Number.isNaN(bookId) || Number.isNaN(pageNumber)) {
			return new Response("Invalid parameters", { status: 400 });
		}

		await assertUserCanAccessBook(auth.userId, bookId);

		// Look up the book's CBZ file
		const cbzFile = await db.query.bookFiles.findFirst({
			where: and(eq(bookFiles.bookId, bookId), eq(bookFiles.format, "cbz")),
		});

		if (!cbzFile) {
			return new Response("CBZ file not found for this book", {
				status: 404,
			});
		}

		if (!existsSync(cbzFile.filePath)) {
			return new Response("File not found on disk", { status: 404 });
		}

		let zip: AdmZip;
		try {
			zip = new AdmZip(cbzFile.filePath);
		} catch {
			return new Response("Failed to open CBZ file", { status: 500 });
		}

		const imageEntries = zip
			.getEntries()
			.filter((e) => {
				const ext = path.extname(e.entryName).slice(1).toLowerCase();
				return IMAGE_EXTENSIONS.has(ext) && !e.isDirectory;
			})
			.toSorted((a, b) => a.entryName.localeCompare(b.entryName));

		if (pageNumber < 0 || pageNumber >= imageEntries.length) {
			return new Response("Page out of range", { status: 404 });
		}

		const entry = imageEntries[pageNumber];
		if (!entry) {
			return new Response("Page not found", { status: 404 });
		}

		const ext = path.extname(entry.entryName).slice(1).toLowerCase();
		const contentType = getImageMimeType(ext);
		let raw: Buffer;
		try {
			raw = entry.getData();
		} catch {
			return new Response("Failed to extract page", { status: 500 });
		}

		const data = raw.buffer.slice(
			raw.byteOffset,
			raw.byteOffset + raw.byteLength,
		) as ArrayBuffer;

		return new Response(data, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "private, max-age=3600",
			},
		});
	} catch (error) {
		return (
			responseFromHttpError(error) ??
			new Response("Internal Server Error", { status: 500 })
		);
	}
}

export const Route = createFileRoute("/api/opds/pse/$bookId/$pageNumber")({
	server: {
		handlers: {
			GET: handleOpdsPseRequest,
		},
	},
});
