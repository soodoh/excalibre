import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { assertUserCanAccessBook } from "src/server/access-control";
import { responseFromHttpError } from "src/server/http-errors";
import { requireRequestAuth } from "src/server/request-auth-resolver";

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
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { bookId: string };
			}) => {
				try {
					const bookId = Number(params.bookId);
					if (Number.isNaN(bookId)) {
						return new Response("Invalid book ID", { status: 400 });
					}

					const requestAuth = await requireRequestAuth(request);
					const book = await assertUserCanAccessBook(
						requestAuth.userId,
						bookId,
					);

					if (!book.coverPath) {
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
							"Cache-Control": "private, max-age=3600",
						},
					});
				} catch (error) {
					const httpErrorResponse = responseFromHttpError(error);
					if (httpErrorResponse) {
						return httpErrorResponse;
					}

					return new Response("Internal Server Error", { status: 500 });
				}
			},
		},
	},
});
