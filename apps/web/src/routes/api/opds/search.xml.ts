import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/opds/search/xml")({
	server: {
		handlers: {
			GET: ({ request }: { request: Request }) => {
				const url = new URL(request.url);
				const baseUrl = `${url.protocol}//${url.host}`;

				const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Excalibre</ShortName>
  <Description>Search Excalibre book catalog</Description>
  <Url type="application/atom+xml; profile=opds-catalog; kind=acquisition"
       template="${baseUrl}/api/opds/search?q={searchTerms}"/>
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
