import { createFileRoute } from "@tanstack/react-router";
import {
	authenticateOpds,
	getAccessibleLibraries,
	opdsFooter,
	opdsHeader,
	opdsNavigationEntry,
	opdsXmlResponse,
} from "src/server/opds";

export const Route = createFileRoute("/api/opds/")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const auth = await authenticateOpds(request);
				if (!auth) {
					return new Response("Unauthorized", {
						status: 401,
						headers: {
							"WWW-Authenticate": 'Basic realm="Excalibre OPDS"',
						},
					});
				}

				const url = new URL(request.url);
				const baseUrl = `${url.protocol}//${url.host}`;
				const selfHref = `${baseUrl}/api/opds`;

				const accessibleLibraries = await getAccessibleLibraries(auth.userId);

				let xml = opdsHeader(
					"urn:excalibre:opds:root",
					"Excalibre Library",
					selfHref,
					baseUrl,
				);

				xml += opdsNavigationEntry(
					"urn:excalibre:opds:all",
					"All Books",
					`${baseUrl}/api/opds/all`,
					"Browse all books in your library",
				);

				xml += opdsNavigationEntry(
					"urn:excalibre:opds:recent",
					"Recently Added",
					`${baseUrl}/api/opds/recent`,
					"Books recently added to your library",
				);

				for (const lib of accessibleLibraries) {
					xml += opdsNavigationEntry(
						`urn:excalibre:opds:library:${lib.id}`,
						lib.name,
						`${baseUrl}/api/opds/libraries/${lib.id}`,
						`Browse books in ${lib.name}`,
					);
				}

				xml += opdsFooter();

				return opdsXmlResponse(xml);
			},
		},
	},
});
