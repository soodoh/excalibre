// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return
import type { JSX } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, User } from "lucide-react";
import { getAuthorDetailFn } from "src/server/authors";
import { queryKeys } from "src/lib/query-keys";
import { Button } from "src/components/ui/button";
import { Skeleton } from "src/components/ui/skeleton";
import BookGrid from "src/components/library/book-grid";

export const Route = createFileRoute("/_authed/authors/$authorId")({
  component: AuthorDetailPage,
});

function AuthorDetailPageSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-24" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          // oxlint-disable-next-line react/no-array-index-key
          <div key={i} className="flex flex-col gap-2 p-1">
            <Skeleton className="aspect-[2/3] w-full rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthorDetailPage(): JSX.Element {
  const { authorId } = Route.useParams();
  const authorIdNum = Number(authorId);
  const router = useRouter();

  const { data: author, isLoading } = useQuery({
    queryKey: queryKeys.authors.detail(authorIdNum),
    queryFn: () => getAuthorDetailFn({ data: { id: authorIdNum } }),
    enabled: !Number.isNaN(authorIdNum),
  });

  const handleBack = (): void => {
    router.history.back();
  };

  if (isLoading) {
    return <AuthorDetailPageSkeleton />;
  }

  if (!author) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Author not found
      </div>
    );
  }

  const authorData = author as unknown as {
    id: number;
    name: string;
    bio: string | null;
    books: Array<{
      id: number;
      title: string;
      coverPath: string | null;
      seriesIndex: number | null;
      createdAt: Date;
    }>;
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

      {/* Author info */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <User className="size-8 text-muted-foreground" />
          <h1 className="text-2xl font-bold leading-tight">
            {authorData.name}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {authorData.books.length}{" "}
          {authorData.books.length === 1 ? "book" : "books"}
        </p>
        {authorData.bio && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {authorData.bio}
          </p>
        )}
      </div>

      {/* Books */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Books</h2>
        <BookGrid books={authorData.books} isLoading={false} />
      </div>
    </div>
  );
}
