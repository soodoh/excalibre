// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return
import type { JSX } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Library } from "lucide-react";
import { getSeriesDetailFn } from "src/server/authors";
import { queryKeys } from "src/lib/query-keys";
import { Button } from "src/components/ui/button";
import { Skeleton } from "src/components/ui/skeleton";

export const Route = createFileRoute("/_authed/series/$seriesId")({
  component: SeriesDetailPage,
});

type SeriesBook = {
  id: number;
  title: string;
  coverPath: string | null;
  seriesIndex: number | null;
  createdAt: Date;
};

function SeriesBookItem({ book }: { book: SeriesBook }): JSX.Element {
  return (
    <Link
      to="/books/$bookId"
      params={{ bookId: String(book.id) }}
      className="group flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      {/* Series index badge */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
        {book.seriesIndex !== null && book.seriesIndex !== undefined
          ? `#${book.seriesIndex}`
          : "?"}
      </div>

      {/* Cover thumbnail */}
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
        {book.coverPath ? (
          <img
            src={`/api/covers/${book.id}`}
            alt={book.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <BookOpen className="size-4 opacity-40" />
          </div>
        )}
      </div>

      {/* Title */}
      <span className="line-clamp-2 text-sm font-medium group-hover:underline">
        {book.title}
      </span>
    </Link>
  );
}

function SeriesDetailPageSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-24" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          // oxlint-disable-next-line react/no-array-index-key
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function SeriesDetailPage(): JSX.Element {
  const { seriesId } = Route.useParams();
  const seriesIdNum = Number(seriesId);
  const router = useRouter();

  const { data: seriesData, isLoading } = useQuery({
    queryKey: queryKeys.series.detail(seriesIdNum),
    queryFn: () => getSeriesDetailFn({ data: { id: seriesIdNum } }),
    enabled: !Number.isNaN(seriesIdNum),
  });

  const handleBack = (): void => {
    router.history.back();
  };

  if (isLoading) {
    return <SeriesDetailPageSkeleton />;
  }

  if (!seriesData) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Series not found
      </div>
    );
  }

  const series = seriesData as unknown as {
    id: number;
    name: string;
    books: SeriesBook[];
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

      {/* Series info */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Library className="size-8 text-muted-foreground" />
          <h1 className="text-2xl font-bold leading-tight">{series.name}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {series.books.length} {series.books.length === 1 ? "book" : "books"}
        </p>
      </div>

      {/* Books ordered by series index */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Books in Series</h2>
        {series.books.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            No books found
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {series.books.map((book) => (
              <SeriesBookItem key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
