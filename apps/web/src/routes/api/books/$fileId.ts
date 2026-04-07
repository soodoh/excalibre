import { existsSync, readFileSync } from "node:fs";
import { createFileRoute } from "@tanstack/react-router";
import { assertUserCanAccessBookFile } from "src/server/access-control";
import { responseFromHttpError } from "src/server/http-errors";
import { requireRequestAuth } from "src/server/request-auth-resolver";

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
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { fileId: string };
			}) => {
				try {
					const fileId = Number(params.fileId);
					if (Number.isNaN(fileId)) {
						return new Response("Invalid file ID", { status: 400 });
					}

					const requestAuth = await requireRequestAuth(request);
					const file = await assertUserCanAccessBookFile(
						requestAuth.userId,
						fileId,
					);

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
