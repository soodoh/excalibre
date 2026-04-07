import { createFileRoute } from "@tanstack/react-router";
import { authenticateOpds } from "src/server/opds";
import { appendRequestAuthToUrl } from "src/server/request-auth";

export const Route = createFileRoute("/api/opds/search/xml")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const url = new URL(request.url);
				const baseUrl = `${url.protocol}//${url.host}`;
				const auth = await authenticateOpds(request);
				const searchTemplate = appendRequestAuthToUrl(
					`${baseUrl}/api/opds/search?q={searchTerms}`,
					auth ?? { mode: "session", userId: "" },
				);

				const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Excalibre</ShortName>
  <Description>Search Excalibre book catalog</Description>
  <Url type="application/atom+xml; profile=opds-catalog; kind=acquisition"
       template="${searchTemplate}"/>
</OpenSearchDescription>`;

				return new Response(xml, {
					status: 200,
					headers: {
						"Content-Type":
							"application/opensearchdescription+xml; charset=utf-8",
					},
				});
			},
		},
	},
});
