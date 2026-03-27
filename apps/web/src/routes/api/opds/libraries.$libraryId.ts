import { createFileRoute } from "@tanstack/react-router";
import { db } from "src/db";
import {
  books,
  bookFiles,
  authors,
  booksAuthors,
  libraries,
  libraryAccess,
  user,
} from "src/db/schema";
import { eq, and, inArray, desc, count } from "drizzle-orm";
import {
  authenticateOpds,
  opdsXmlResponse,
  opdsHeader,
  opdsFooter,
  opdsBookEntry,
  escapeXml,
} from "src/server/opds";

const PAGE_SIZE = 50;

export const Route = createFileRoute("/api/opds/libraries/$libraryId")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { libraryId: string };
      }) => {
        const auth = await authenticateOpds(request);
        if (!auth) {
          return new Response("Unauthorized", {
            status: 401,
            headers: { "WWW-Authenticate": 'Basic realm="Excalibre OPDS"' },
          });
        }

        const libraryId = Number(params.libraryId);
        if (Number.isNaN(libraryId)) {
          return new Response("Invalid library ID", { status: 400 });
        }

        // Verify the library exists
        const library = await db.query.libraries.findFirst({
          where: eq(libraries.id, libraryId),
        });

        if (!library) {
          return new Response("Library not found", { status: 404 });
        }

        // Check access: admin can access all, others need an entry in libraryAccess
        const userRecord = await db.query.user.findFirst({
          where: eq(user.id, auth.userId),
          columns: { role: true },
        });

        if (userRecord?.role !== "admin") {
          const access = await db.query.libraryAccess.findFirst({
            where: and(
              eq(libraryAccess.userId, auth.userId),
              eq(libraryAccess.libraryId, libraryId),
            ),
          });
          if (!access) {
            return new Response("Forbidden", { status: 403 });
          }
        }

        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        const page = Math.max(0, Number(url.searchParams.get("page") ?? "0"));
        const offset = page * PAGE_SIZE;

        const [bookRows, totalRows] = await Promise.all([
          db
            .select()
            .from(books)
            .where(eq(books.libraryId, libraryId))
            .orderBy(desc(books.createdAt))
            .limit(PAGE_SIZE)
            .offset(offset),
          db
            .select({ value: count() })
            .from(books)
            .where(eq(books.libraryId, libraryId)),
        ]);

        const total = totalRows[0]?.value ?? 0;
        const hasMore = offset + bookRows.length < total;

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

        const selfHref = `${baseUrl}/api/opds/libraries/${libraryId}?page=${page}`;
        let xml = opdsHeader(
          `urn:excalibre:opds:library:${libraryId}`,
          library.name,
          selfHref,
          baseUrl,
        );

        if (page > 0) {
          xml += `  <link rel="previous" href="${escapeXml(`${baseUrl}/api/opds/libraries/${libraryId}?page=${page - 1}`)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>\n`;
        }
        if (hasMore) {
          xml += `  <link rel="next" href="${escapeXml(`${baseUrl}/api/opds/libraries/${libraryId}?page=${page + 1}`)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>\n`;
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
