// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";
import BookGrid from "src/components/library/book-grid";
import { CollectionForm } from "src/components/organization/collection-form";
import { Button } from "src/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "src/components/ui/dialog";
import { Skeleton } from "src/components/ui/skeleton";
import { queryKeys } from "src/lib/query-keys";
import {
	deleteCollectionFn,
	getCollectionBooksFn,
	getCollectionsFn,
	removeBookFromCollectionFn,
} from "src/server/collections";

export const Route = createFileRoute("/_authed/collections/$collectionId")({
	component: CollectionBrowsePage,
});

type CollectionBook = {
	id: number;
	title: string;
	coverPath: string | null;
	authorName?: string;
};

function CollectionBrowsePageSkeleton(): JSX.Element {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<Skeleton className="h-8 w-24" />
			</div>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-9 w-48" />
				<Skeleton className="h-4 w-24" />
			</div>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{Array.from({ length: 12 }, (_, i) => `skeleton-${i}`).map((key) => (
					<div key={key} className="flex flex-col gap-2 p-1">
						<Skeleton className="aspect-[2/3] w-full rounded-md" />
						<Skeleton className="h-4 w-3/4 rounded" />
						<Skeleton className="h-3 w-1/2 rounded" />
					</div>
				))}
			</div>
		</div>
	);
}

function CollectionBrowsePage(): JSX.Element {
	const { collectionId } = Route.useParams();
	const collectionIdNum = Number(collectionId);
	const router = useRouter();
	const queryClient = useQueryClient();
	const [deleteOpen, setDeleteOpen] = useState(false);

	// Get the collection detail from the list query
	const { data: collections, isLoading: isCollectionLoading } = useQuery({
		queryKey: queryKeys.collections.list(),
		queryFn: async () => getCollectionsFn(),
		enabled: !Number.isNaN(collectionIdNum),
	});

	const collection = collections?.find((c) => c.id === collectionIdNum);

	const { data: books, isLoading: isBooksLoading } = useQuery({
		queryKey: queryKeys.collections.books(collectionIdNum),
		queryFn: () =>
			getCollectionBooksFn({ data: { collectionId: collectionIdNum } }),
		enabled: !Number.isNaN(collectionIdNum),
	});

	const deleteMutation = useMutation({
		mutationFn: () => deleteCollectionFn({ data: { id: collectionIdNum } }),
		onSuccess: async () => {
			toast.success("Collection deleted");
			await queryClient.invalidateQueries({
				queryKey: queryKeys.collections.all,
			});
			router.history.back();
		},
		onError: (error: Error) => {
			toast.error(error.message ?? "Failed to delete collection");
		},
	});

	const removeBookMutation = useMutation({
		mutationFn: (bookId: number) =>
			removeBookFromCollectionFn({
				data: { collectionId: collectionIdNum, bookId },
			}),
		onSuccess: async () => {
			toast.success("Book removed from collection");
			await queryClient.invalidateQueries({
				queryKey: queryKeys.collections.books(collectionIdNum),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message ?? "Failed to remove book");
		},
	});

	if (isCollectionLoading) {
		return <CollectionBrowsePageSkeleton />;
	}

	if (!collection) {
		return (
			<div className="flex h-40 items-center justify-center text-muted-foreground">
				Collection not found
			</div>
		);
	}

	const bookList = (books ?? []) as CollectionBook[];

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
				<h1 className="text-2xl font-bold">{collection.name}</h1>
				<p className="text-sm text-muted-foreground">
					{bookList.length} {bookList.length === 1 ? "book" : "books"}
				</p>
			</div>

			{/* Actions */}
			<div className="flex gap-2">
				<CollectionForm
					collection={{ id: collection.id, name: collection.name }}
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

			{/* Books grid with remove option */}
			{bookList.length > 0 ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{bookList.map((book) => (
						<div key={book.id} className="relative group">
							<button
								type="button"
								aria-label="Remove from collection"
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
						<DialogTitle>Delete Collection</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						Are you sure you want to delete &ldquo;{collection.name}&rdquo;?
						This action cannot be undone.
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
