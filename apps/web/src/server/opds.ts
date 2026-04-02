import { eq, inArray } from "drizzle-orm";
import { db } from "src/db";
import type { bookFiles, books } from "src/db/schema";
import { libraries, libraryAccess, opdsKeys, user } from "src/db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type BookRecord = typeof books.$inferSelect;
type BookFileRecord = typeof bookFiles.$inferSelect;
type AuthorRecord = { id: number; name: string; role: string };
type LibraryRecord = typeof libraries.$inferSelect;

export type OpdsAuthResult = {
	userId: string;
};

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
			return { userId: keyRecord.userId };
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

		const baseUrl = `${url.protocol}//${url.host}`;
		try {
			const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});

			if (!response.ok) {
				return null;
			}
		} catch {
			return null;
		}

		const userRecord = await db.query.user.findFirst({
			where: eq(user.email, email),
			columns: { id: true },
		});

		if (!userRecord) {
			return null;
		}

		return { userId: userRecord.id };
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
	updated?: Date,
): string {
	const updatedStr = (updated ?? new Date()).toISOString();
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
  <link rel="self" href="${escapeXml(selfHref)}" type="application/atom+xml; profile=opds-catalog; kind=navigation"/>
  <link rel="start" href="${escapeXml(baseUrl)}/api/opds" type="application/atom+xml; profile=opds-catalog; kind=navigation"/>
  <link rel="search" href="${escapeXml(baseUrl)}/api/opds/search/xml" type="application/opensearchdescription+xml"/>
`;
}

export function opdsFooter(): string {
	return `</feed>`;
}

export function opdsNavigationEntry(
	id: string,
	title: string,
	href: string,
	content?: string,
): string {
	const contentEl = content
		? `  <content type="text">${escapeXml(content)}</content>\n`
		: "";
	return `  <entry>
    <id>${escapeXml(id)}</id>
    <title>${escapeXml(title)}</title>
    <updated>${new Date().toISOString()}</updated>
${contentEl}    <link rel="subsection" href="${escapeXml(href)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>
  </entry>
`;
}

export function opdsBookEntry(
	book: BookRecord,
	files: BookFileRecord[],
	bookAuthors: AuthorRecord[],
	baseUrl: string,
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

	const coverEl = book.coverPath
		? `    <link rel="http://opds-spec.org/image" href="${escapeXml(baseUrl)}/api/covers/${book.id}" type="image/jpeg"/>\n    <link rel="http://opds-spec.org/image/thumbnail" href="${escapeXml(baseUrl)}/api/covers/${book.id}" type="image/jpeg"/>\n`
		: "";

	const acquisitionLinks = files
		.map((f) => {
			const fmt = f.format.toLowerCase();
			const mimeType = BOOK_MIME_TYPES[fmt] ?? "application/octet-stream";

			if (fmt === "cbz" && book.pageCount) {
				return `    <link rel="http://opds-spec.org/acquisition/open-access" href="${escapeXml(baseUrl)}/api/books/${f.id}" type="${mimeType}"/>
    <link rel="http://vaemendis.net/opds-pse/stream" href="${escapeXml(baseUrl)}/api/opds/pse/${book.id}/{pageNumber}" type="image/jpeg" pse:count="${book.pageCount}"/>`;
			}

			return `    <link rel="http://opds-spec.org/acquisition/open-access" href="${escapeXml(baseUrl)}/api/books/${f.id}" type="${mimeType}"/>`;
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

// ─── Accessible libraries helper ──────────────────────────────────────────────

export async function getAccessibleLibraries(
	userId: string,
): Promise<LibraryRecord[]> {
	// Check if user is admin
	const userRecord = await db.query.user.findFirst({
		where: eq(user.id, userId),
		columns: { role: true },
	});

	if (userRecord?.role === "admin") {
		return db.select().from(libraries);
	}

	const access = await db
		.select({ libraryId: libraryAccess.libraryId })
		.from(libraryAccess)
		.where(eq(libraryAccess.userId, userId));

	if (access.length === 0) {
		return [];
	}

	const ids = access.map((a) => a.libraryId);
	return db.select().from(libraries).where(inArray(libraries.id, ids));
}

export async function getAccessibleLibraryIds(
	userId: string,
): Promise<number[]> {
	const libs = await getAccessibleLibraries(userId);
	return libs.map((l) => l.id);
}
