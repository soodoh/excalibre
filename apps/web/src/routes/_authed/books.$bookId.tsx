// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return
// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return
import type { JSX } from "react";
import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ArrowLeft, Plus } from "lucide-react";
import { getBookDetailFn } from "src/server/books";
import { queryKeys } from "src/lib/query-keys";
import { Badge } from "src/components/ui/badge";
import { Button } from "src/components/ui/button";
import { Separator } from "src/components/ui/separator";
import { Skeleton } from "src/components/ui/skeleton";
import { AddToShelf } from "src/components/organization/add-to-shelf";

export const Route = createFileRoute("/_authed/books/$bookId")({
  component: BookDetailPage,
});

function humanFileSize(bytes: number | null | undefined): string {
  if (!bytes) {
    return "Unknown";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type BookDetail = {
  id: number;
  title: string;
  description: string | null;
  coverPath: string | null;
  publisher: string | null;
  publishDate: string | null;
  language: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  rating: number | null;
  seriesId: number | null;
  seriesIndex: number | null;
  libraryId: number;
  authors: Array<{
    id: number;
    name: string;
    role: "author" | "editor" | "translator" | "illustrator";
  }>;
  files: Array<{
    id: number;
    format: string;
    fileSize: number | null;
    source: string;
  }>;
  series: { id: number; name: string } | null;
  tags: Array<{ id: number; name: string }>;
};

function CoverImage({
  bookId,
  coverPath,
  title,
}: {
  bookId: number;
  coverPath: string | null;
  title: string;
}): JSX.Element {
  const [imgError, setImgError] = useState(false);

  if (!coverPath || imgError) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <BookOpen className="size-16 opacity-40" />
      </div>
    );
  }

  return (
    <img
      src={`/api/covers/${bookId}`}
      alt={title}
      className="h-full w-full rounded-lg object-cover shadow-md"
      onError={() => setImgError(true)}
    />
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): JSX.Element {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

const FORMAT_PRIORITY = ["epub", "pdf", "cbz", "mobi", "azw3", "fb2"];

function getBestFile(
  files: BookDetail["files"],
): BookDetail["files"][number] | undefined {
  return [...files].toSorted((a, b) => {
    const aIdx = FORMAT_PRIORITY.indexOf(a.format);
    const bIdx = FORMAT_PRIORITY.indexOf(b.format);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  })[0];
}

function BookDetailContent({ book }: { book: BookDetail }): JSX.Element {
  const router = useRouter();
  const bestFile = getBestFile(book.files);

  const handleBack = (): void => {
    router.history.back();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-1.5 size-4" />
          Back
        </Button>
      </div>

      {/* Main layout */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Cover */}
        <div className="w-full shrink-0 sm:w-48 md:w-56 lg:w-64">
          <div className="aspect-[2/3] w-full">
            <CoverImage
              bookId={book.id}
              coverPath={book.coverPath}
              title={book.title}
            />
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight">{book.title}</h1>

            {/* Authors */}
            {book.authors.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1 text-sm text-muted-foreground">
                {book.authors.map((author, idx) => (
                  <span key={author.id}>
                    <Link
                      to="/authors/$authorId"
                      params={{ authorId: String(author.id) }}
                      className="hover:text-foreground hover:underline"
                    >
                      {author.name}
                    </Link>
                    {author.role !== "author" && (
                      <span className="text-xs"> ({author.role})</span>
                    )}
                    {idx < book.authors.length - 1 && ", "}
                  </span>
                ))}
              </div>
            )}

            {/* Series */}
            {book.series && (
              <div className="mt-1 text-sm text-muted-foreground">
                <Link
                  to="/series/$seriesId"
                  params={{ seriesId: String(book.series.id) }}
                  className="hover:text-foreground hover:underline"
                >
                  {book.series.name}
                </Link>
                {book.seriesIndex !== null &&
                  book.seriesIndex !== undefined && (
                    <span> (#{book.seriesIndex})</span>
                  )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {bestFile ? (
              <Link
                to="/read/$bookId/$fileId"
                params={{
                  bookId: String(book.id),
                  fileId: String(bestFile.id),
                }}
              >
                <Button>
                  <BookOpen className="mr-1.5 size-4" />
                  Read
                </Button>
              </Link>
            ) : (
              <Button disabled>No readable files</Button>
            )}
            <AddToShelf
              bookId={book.id}
              trigger={
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add to...
                </Button>
              }
            />
          </div>

          <Separator />

          {/* Description */}
          {book.description && (
            <div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {book.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {book.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Details grid */}
          <div className="flex flex-col gap-2">
            {book.publisher && (
              <MetaRow label="Publisher" value={book.publisher} />
            )}
            {book.publishDate && (
              <MetaRow label="Published" value={book.publishDate} />
            )}
            {book.language && (
              <MetaRow label="Language" value={book.language.toUpperCase()} />
            )}
            {book.pageCount && (
              <MetaRow label="Pages" value={book.pageCount.toLocaleString()} />
            )}
            {book.isbn13 && <MetaRow label="ISBN-13" value={book.isbn13} />}
            {book.isbn10 && <MetaRow label="ISBN-10" value={book.isbn10} />}
            {book.rating !== null && book.rating !== undefined && (
              <MetaRow label="Rating" value={`${book.rating.toFixed(1)} / 5`} />
            )}
          </div>
        </div>
      </div>

      {/* Files section */}
      {book.files.length > 0 && (
        <div>
          <Separator className="mb-4" />
          <h2 className="mb-3 text-lg font-semibold">Files</h2>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Format</th>
                  <th className="px-4 py-2 text-left font-medium">Size</th>
                  <th className="px-4 py-2 text-left font-medium">Source</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {book.files.map((file) => (
                  <tr key={file.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <Badge variant="outline">
                        {file.format.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {humanFileSize(file.fileSize)}
                    </td>
                    <td className="px-4 py-2 capitalize text-muted-foreground">
                      {file.source}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to="/read/$bookId/$fileId"
                        params={{
                          bookId: String(book.id),
                          fileId: String(file.id),
                        }}
                      >
                        <Button variant="ghost" size="sm">
                          Read
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BookDetailPageSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-24" />
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton className="aspect-[2/3] w-full shrink-0 rounded-lg sm:w-48 md:w-56 lg:w-64" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-20 w-full" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              // oxlint-disable-next-line react/no-array-index-key
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookDetailPage(): JSX.Element {
  const { bookId } = Route.useParams();
  const bookIdNum = Number(bookId);

  const { data: book, isLoading } = useQuery({
    queryKey: queryKeys.books.detail(bookIdNum),
    queryFn: () => getBookDetailFn({ data: { id: bookIdNum } }),
    enabled: !Number.isNaN(bookIdNum),
  });

  if (isLoading) {
    return <BookDetailPageSkeleton />;
  }

  if (!book) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Book not found
      </div>
    );
  }

  return <BookDetailContent book={book as unknown as BookDetail} />;
}
