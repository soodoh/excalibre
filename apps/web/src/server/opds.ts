import { eq } from "drizzle-orm";
import { db } from "src/db";
import type { bookFiles, books } from "src/db/schema";
import { opdsKeys } from "src/db/schema";
import {
	getAccessibleLibraries,
	getAccessibleLibraryIds,
} from "src/server/access-control";
import { verifyStatelessCredentials } from "src/server/kosync";
import {
	appendRequestAuthToUrl,
	type RequestAuth,
} from "src/server/request-auth";

// ─── Types ───────────────────────────────────────────────────────────────────

type BookRecord = typeof books.$inferSelect;
type BookFileRecord = typeof bookFiles.$inferSelect;
type AuthorRecord = { id: number; name: string; role: string };
type OpdsAuthResult = Extract<RequestAuth, { mode: "opds" }>;

// ─── MIME types ───────────────────────────────────────────────────────────────

export const BOOK_MIME_TYPES: Record<string, string> = {
	epub: "application/epub+zip",
	pdf: "application/pdf",
	mobi: "application/x-mobipocket-ebook",
	cbz: "application/x-cbz",
};

// ─── Authentication ───────────────────────────────────────────────────────────

/**
 * Authenticates an OPDS request via HTTP Basic Auth or ?apikey= query param.
 * Returns { userId } on success, or null on failure.
 */
export async function authenticateOpds(
	request: Request,
): Promise<OpdsAuthResult | null> {
	const url = new URL(request.url);

	// Check ?apikey= query param first
	const apiKey = url.searchParams.get("apikey");
	if (apiKey) {
		const keyRecord = await db.query.opdsKeys.findFirst({
			where: eq(opdsKeys.apiKey, apiKey),
		});
		if (keyRecord) {
			return { mode: "opds", userId: keyRecord.userId, apiKey };
		}
		return null;
	}

	// Check HTTP Basic Auth
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Basic ")) {
		const base64 = authHeader.slice(6);
		let decoded: string;
		try {
			decoded = atob(base64);
		} catch {
			return null;
		}

		const colonIdx = decoded.indexOf(":");
		if (colonIdx === -1) {
			return null;
		}

		const email = decoded.slice(0, colonIdx);
		const password = decoded.slice(colonIdx + 1);

		if (!email || !password) {
			return null;
		}

		const userRecord = await verifyStatelessCredentials(email, password);
		if (userRecord) {
			return { mode: "opds", userId: userRecord.id };
		}
	}

	return null;
}

// ─── Response helper ──────────────────────────────────────────────────────────

export function opdsXmlResponse(xml: string): Response {
	return new Response(xml, {
		status: 200,
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
		},
	});
}

// ─── XML escaping ─────────────────────────────────────────────────────────────

export function escapeXml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

// ─── Feed building blocks ─────────────────────────────────────────────────────

export function opdsHeader(
	id: string,
	title: string,
	selfHref: string,
	baseUrl: string,
	requestAuth?: RequestAuth,
	updated?: Date,
): string {
	const updatedStr = (updated ?? new Date()).toISOString();
	const authorizedSelfHref = requestAuth
		? appendRequestAuthToUrl(selfHref, requestAuth)
		: selfHref;
	const startHref = appendRequestAuthToUrl(
		`${baseUrl}/api/opds`,
		requestAuth ?? {
			mode: "session",
			userId: "",
		},
	);
	const searchHref = appendRequestAuthToUrl(
		`${baseUrl}/api/opds/search/xml`,
		requestAuth ?? {
			mode: "session",
			userId: "",
		},
	);
	return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:opds="http://opds-spec.org/2010/catalog"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:pse="http://vaemendis.net/opds-pse/ns">
  <id>${escapeXml(id)}</id>
  <title>${escapeXml(title)}</title>
  <updated>${updatedStr}</updated>
  <author>
    <name>Excalibre</name>
  </author>
  <link rel="self" href="${escapeXml(authorizedSelfHref)}" type="application/atom+xml; profile=opds-catalog; kind=navigation"/>
  <link rel="start" href="${escapeXml(startHref)}" type="application/atom+xml; profile=opds-catalog; kind=navigation"/>
  <link rel="search" href="${escapeXml(searchHref)}" type="application/opensearchdescription+xml"/>
`;
}

export function opdsFooter(): string {
	return `</feed>`;
}

export function opdsNavigationEntry(
	id: string,
	title: string,
	href: string,
	requestAuth?: RequestAuth,
	content?: string,
): string {
	const contentEl = content
		? `  <content type="text">${escapeXml(content)}</content>\n`
		: "";
	const authorizedHref = requestAuth
		? appendRequestAuthToUrl(href, requestAuth)
		: href;
	return `  <entry>
    <id>${escapeXml(id)}</id>
    <title>${escapeXml(title)}</title>
    <updated>${new Date().toISOString()}</updated>
${contentEl}    <link rel="subsection" href="${escapeXml(authorizedHref)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>
  </entry>
`;
}

export function opdsBookEntry(
	book: BookRecord,
	files: BookFileRecord[],
	bookAuthors: AuthorRecord[],
	baseUrl: string,
	requestAuth?: RequestAuth,
): string {
	const authorsXml = bookAuthors
		.map((a) => `    <author><name>${escapeXml(a.name)}</name></author>`)
		.join("\n");

	const languageEl = book.language
		? `    <dc:language>${escapeXml(book.language)}</dc:language>\n`
		: "";
	const publisherEl = book.publisher
		? `    <dc:publisher>${escapeXml(book.publisher)}</dc:publisher>\n`
		: "";
	const summaryEl = book.description
		? `    <summary>${escapeXml(book.description)}</summary>\n`
		: "";

	const coverUrl = requestAuth
		? appendRequestAuthToUrl(`${baseUrl}/api/covers/${book.id}`, requestAuth)
		: `${baseUrl}/api/covers/${book.id}`;
	const coverEl = book.coverPath
		? `    <link rel="http://opds-spec.org/image" href="${escapeXml(coverUrl)}" type="image/jpeg"/>\n    <link rel="http://opds-spec.org/image/thumbnail" href="${escapeXml(coverUrl)}" type="image/jpeg"/>\n`
		: "";

	const acquisitionLinks = files
		.map((f) => {
			const fmt = f.format.toLowerCase();
			const mimeType = BOOK_MIME_TYPES[fmt] ?? "application/octet-stream";
			const acquisitionUrl = requestAuth
				? appendRequestAuthToUrl(`${baseUrl}/api/books/${f.id}`, requestAuth)
				: `${baseUrl}/api/books/${f.id}`;
			const pageStreamUrl = requestAuth
				? appendRequestAuthToUrl(
						`${baseUrl}/api/opds/pse/${book.id}/{pageNumber}`,
						requestAuth,
					)
				: `${baseUrl}/api/opds/pse/${book.id}/{pageNumber}`;

			if (fmt === "cbz" && book.pageCount) {
				return `    <link rel="http://opds-spec.org/acquisition/open-access" href="${escapeXml(acquisitionUrl)}" type="${mimeType}"/>
    <link rel="http://vaemendis.net/opds-pse/stream" href="${escapeXml(pageStreamUrl)}" type="image/jpeg" pse:count="${book.pageCount}"/>`;
			}

			return `    <link rel="http://opds-spec.org/acquisition/open-access" href="${escapeXml(acquisitionUrl)}" type="${mimeType}"/>`;
		})
		.join("\n");

	return `  <entry>
    <id>urn:excalibre:book:${book.id}</id>
    <title>${escapeXml(book.title)}</title>
    <updated>${book.updatedAt.toISOString()}</updated>
${authorsXml ? `${authorsXml}\n` : ""}${languageEl}${publisherEl}${summaryEl}${coverEl}${acquisitionLinks}
  </entry>
`;
}

export { getAccessibleLibraries, getAccessibleLibraryIds };
