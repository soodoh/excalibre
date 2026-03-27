// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return
import type { JSX } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import {
  getShelfFn,
  getShelfBooksFn,
  deleteShelfFn,
  removeBookFromShelfFn,
} from "src/server/shelves";
import { queryKeys } from "src/lib/query-keys";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/badge";
import { Skeleton } from "src/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "src/components/ui/dialog";
import { ShelfForm } from "src/components/organization/shelf-form";
import BookGrid from "src/components/library/book-grid";
import { useState } from "react";

export const Route = createFileRoute("/_authed/shelves/$shelfId")({
  component: ShelfBrowsePage,
});

type ShelfBook = {
  id: number;
  title: string;
  coverPath: string | null;
  authorName?: string;
};

function ShelfBrowsePageSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          // oxlint-disable-next-line react/no-array-index-key
          <div key={i} className="flex flex-col gap-2 p-1">
            <Skeleton className="aspect-[2/3] w-full rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ShelfBrowsePage(): JSX.Element {
  const { shelfId } = Route.useParams();
  const shelfIdNum = Number(shelfId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: shelf, isLoading: isShelfLoading } = useQuery({
    queryKey: queryKeys.shelves.detail(shelfIdNum),
    queryFn: () => getShelfFn({ data: { shelfId: shelfIdNum } }),
    enabled: !Number.isNaN(shelfIdNum),
  });

  const { data: books, isLoading: isBooksLoading } = useQuery({
    queryKey: queryKeys.shelves.books(shelfIdNum),
    queryFn: () => getShelfBooksFn({ data: { shelfId: shelfIdNum } }),
    enabled: !Number.isNaN(shelfIdNum),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteShelfFn({ data: { id: shelfIdNum } }),
    onSuccess: async () => {
      toast.success("Shelf deleted");
      await queryClient.invalidateQueries({ queryKey: queryKeys.shelves.all });
      router.history.back();
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to delete shelf");
    },
  });

  const removeBookMutation = useMutation({
    mutationFn: (bookId: number) =>
      removeBookFromShelfFn({ data: { shelfId: shelfIdNum, bookId } }),
    onSuccess: async () => {
      toast.success("Book removed from shelf");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.shelves.books(shelfIdNum),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to remove book");
    },
  });

  if (isShelfLoading) {
    return <ShelfBrowsePageSkeleton />;
  }

  if (!shelf) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Shelf not found
      </div>
    );
  }

  const bookList = (books ?? []) as ShelfBook[];
  const isManual = shelf.type === "manual";

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          <ArrowLeft className="mr-1.5 size-4" />
          Back
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{shelf.name}</h1>
          <Badge variant="secondary">
            {shelf.type === "smart" ? "Smart" : "Manual"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {bookList.length} {bookList.length === 1 ? "book" : "books"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <ShelfForm
          shelf={
            shelf as {
              id: number;
              name: string;
              type: "smart" | "manual";
              filterRules?: Record<string, unknown> | null;
            }
          }
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="mr-1.5 size-4" />
              Edit
            </Button>
          }
        />
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-1.5 size-4" />
          Delete
        </Button>
      </div>

      {/* Books grid */}
      {isManual && bookList.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {bookList.map((book) => (
            <div key={book.id} className="relative group">
              <button
                type="button"
                aria-label="Remove from shelf"
                className="absolute top-1 right-1 z-10 size-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold shadow"
                onClick={() => removeBookMutation.mutate(book.id)}
              >
                ×
              </button>
              <a
                href={`/books/${book.id}`}
                className="group flex flex-col gap-2 rounded-lg p-1 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-muted">
                  {book.coverPath ? (
                    <img
                      src={`/api/covers/${book.id}`}
                      alt={book.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                      <span className="text-2xl opacity-40">📖</span>
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-md ring-1 ring-inset ring-black/10 group-hover:ring-primary/30 transition-all" />
                </div>
                <div className="flex flex-col gap-0.5 px-0.5">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {book.title}
                  </p>
                  {book.authorName && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {book.authorName}
                    </p>
                  )}
                </div>
              </a>
            </div>
          ))}
        </div>
      ) : (
        <BookGrid books={bookList} isLoading={isBooksLoading} />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Shelf</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{shelf.name}&rdquo;? This
            action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
