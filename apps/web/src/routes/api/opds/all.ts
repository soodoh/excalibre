import { createFileRoute } from "@tanstack/react-router";
import { db } from "src/db";
import { books, bookFiles, authors, booksAuthors } from "src/db/schema";
import { eq, inArray, desc, count } from "drizzle-orm";
import {
  authenticateOpds,
  opdsXmlResponse,
  opdsHeader,
  opdsFooter,
  opdsBookEntry,
  escapeXml,
  getAccessibleLibraryIds,
} from "src/server/opds";

const PAGE_SIZE = 50;

export const Route = createFileRoute("/api/opds/all")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await authenticateOpds(request);
        if (!auth) {
          return new Response("Unauthorized", {
            status: 401,
            headers: { "WWW-Authenticate": 'Basic realm="Excalibre OPDS"' },
          });
        }

        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        const page = Math.max(0, Number(url.searchParams.get("page") ?? "0"));
        const offset = page * PAGE_SIZE;

        const libraryIds = await getAccessibleLibraryIds(auth.userId);

        if (libraryIds.length === 0) {
          const xml =
            opdsHeader(
              "urn:excalibre:opds:all",
              "All Books",
              `${baseUrl}/api/opds/all`,
              baseUrl,
            ) + opdsFooter();
          return opdsXmlResponse(xml);
        }

        const [bookRows, totalRows] = await Promise.all([
          db
            .select()
            .from(books)
            .where(inArray(books.libraryId, libraryIds))
            .orderBy(desc(books.createdAt))
            .limit(PAGE_SIZE)
            .offset(offset),
          db
            .select({ value: count() })
            .from(books)
            .where(inArray(books.libraryId, libraryIds)),
        ]);

        const total = totalRows[0]?.value ?? 0;
        const hasMore = offset + bookRows.length < total;

        // Fetch files and authors for all books in one query each
        const bookIds = bookRows.map((b) => b.id);
        const [allFiles, allAuthorRows] =
          bookIds.length > 0
            ? await Promise.all([
                db
                  .select()
                  .from(bookFiles)
                  .where(inArray(bookFiles.bookId, bookIds)),
                db
                  .select({
                    bookId: booksAuthors.bookId,
                    id: authors.id,
                    name: authors.name,
                    role: booksAuthors.role,
                  })
                  .from(booksAuthors)
                  .innerJoin(authors, eq(booksAuthors.authorId, authors.id))
                  .where(inArray(booksAuthors.bookId, bookIds)),
              ])
            : [[], []];

        const selfHref = `${baseUrl}/api/opds/all?page=${page}`;
        let xml = opdsHeader(
          "urn:excalibre:opds:all",
          "All Books",
          selfHref,
          baseUrl,
        );

        if (page > 0) {
          xml += `  <link rel="previous" href="${escapeXml(`${baseUrl}/api/opds/all?page=${page - 1}`)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>\n`;
        }
        if (hasMore) {
          xml += `  <link rel="next" href="${escapeXml(`${baseUrl}/api/opds/all?page=${page + 1}`)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>\n`;
        }

        for (const book of bookRows) {
          const files = allFiles.filter((f) => f.bookId === book.id);
          const bookAuthors = allAuthorRows.filter((a) => a.bookId === book.id);
          xml += opdsBookEntry(book, files, bookAuthors, baseUrl);
        }

        xml += opdsFooter();
        return opdsXmlResponse(xml);
      },
    },
  },
});
