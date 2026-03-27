// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-return
import type { JSX } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getRecentBooksFn } from "src/server/books";
import { queryKeys } from "src/lib/query-keys";
import { useSession } from "src/lib/auth-client";
import BookGrid from "src/components/library/book-grid";

export const Route = createFileRoute("/_authed/")({
  component: HomePage,
});

function HomePage(): JSX.Element {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const { data: recentBooks, isLoading } = useQuery({
    queryKey: queryKeys.books.recent(),
    queryFn: () => getRecentBooksFn({ data: { limit: 12 } }),
  });

  const books = (recentBooks ?? []) as Array<{
    id: number;
    title: string;
    coverPath: string | null;
  }>;

  const isEmpty = !isLoading && books.length === 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Recently Added */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Recently Added</h2>
        {isEmpty ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <p>Your library is empty.</p>
            {isAdmin ? (
              <p className="text-sm">
                Go to{" "}
                <Link
                  to="/settings/libraries"
                  className="underline hover:text-foreground"
                >
                  Settings &rarr; Libraries
                </Link>{" "}
                to add a library.
              </p>
            ) : (
              <p className="text-sm">
                Ask your administrator to add libraries.
              </p>
            )}
          </div>
        ) : (
          <BookGrid books={books} isLoading={isLoading} />
        )}
      </section>

      {/* Continue Reading */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Continue Reading</h2>
        <p className="text-sm text-muted-foreground">Coming soon...</p>
      </section>
    </div>
  );
}
