// oxlint-disable typescript/no-unsafe-call, typescript/no-unsafe-return, typescript/no-unsafe-assignment, typescript/no-unsafe-member-access
import type { JSX } from "react";
import { useState, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getLibraryFn } from "src/server/libraries";
import { getBooksByLibraryFn } from "src/server/books";
import { triggerScanFn } from "src/server/scanner";
import { queryKeys } from "src/lib/query-keys";
import { useSession } from "src/lib/auth-client";
import LibraryHeader from "src/components/library/library-header";
import BookGrid from "src/components/library/book-grid";

export const Route = createFileRoute("/_authed/libraries/$libraryId")({
  component: LibraryBrowsePage,
});

type ScanResult = {
  added: number;
  updated: number;
  missing: number;
};

function LibraryBrowsePage(): JSX.Element {
  const { libraryId } = Route.useParams();
  const libraryIdNum = Number(libraryId);
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: library, isLoading: isLibraryLoading } = useQuery({
    queryKey: queryKeys.libraries.detail(libraryIdNum),
    queryFn: () => getLibraryFn({ data: { id: libraryIdNum } }),
    enabled: !Number.isNaN(libraryIdNum),
  });

  const { data: booksData, isLoading: isBooksLoading } = useQuery({
    queryKey: queryKeys.books.list(libraryIdNum, search || undefined),
    queryFn: () =>
      getBooksByLibraryFn({
        data: {
          libraryId: libraryIdNum,
          search: search || undefined,
          limit: 100,
          offset: 0,
        },
      }),
    enabled: !Number.isNaN(libraryIdNum),
  });

  const scanMutation = useMutation({
    mutationFn: () => triggerScanFn({ data: { libraryId: libraryIdNum } }),
    onSuccess: async (result: ScanResult) => {
      toast.success(
        `Scan complete: ${result.added} added, ${result.updated} updated, ${result.missing} missing`,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.books.list(libraryIdNum),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to scan library");
    },
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleScan = useCallback(() => {
    scanMutation.mutate();
  }, [scanMutation]);

  const isAdmin =
    (session?.user as Record<string, unknown>)?.["role"] === "admin";

  const books = useMemo(() => booksData?.books ?? [], [booksData]);
  const total: number = (booksData?.total as number | undefined) ?? 0;

  if (isLibraryLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Loading library...
      </div>
    );
  }

  if (!library) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Library not found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <LibraryHeader
        library={library as { id: number; name: string }}
        bookCount={total}
        search={search}
        onSearchChange={handleSearchChange}
        onScan={handleScan}
        isScanning={scanMutation.isPending}
        isAdmin={isAdmin}
      />
      <BookGrid
        books={
          books as Array<{
            id: number;
            title: string;
            coverPath: string | null;
            authorName?: string;
          }>
        }
        isLoading={isBooksLoading}
      />
    </div>
  );
}
