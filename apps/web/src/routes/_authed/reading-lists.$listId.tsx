// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	ArrowLeft,
	BookOpen,
	ChevronDown,
	ChevronUp,
	Pencil,
	Trash2,
	X,
} from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { ReadingListForm } from "src/components/organization/reading-list-form";
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
	deleteReadingListFn,
	getReadingListBooksFn,
	getReadingListsFn,
	removeBookFromReadingListFn,
	reorderReadingListFn,
} from "src/server/reading-lists";

export const Route = createFileRoute("/_authed/reading-lists/$listId")({
	component: ReadingListBrowsePage,
});

type ReadingListBook = {
	id: number;
	title: string;
	coverPath: string | null;
	sortOrder: number | null;
};

function ReadingListPageSkeleton(): JSX.Element {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<Skeleton className="h-8 w-24" />
			</div>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-9 w-48" />
				<Skeleton className="h-4 w-24" />
			</div>
			<div className="flex flex-col gap-2">
				{Array.from({ length: 6 }, (_, i) => `skeleton-${i}`).map((key) => (
					<Skeleton key={key} className="h-20 w-full rounded-md" />
				))}
			</div>
		</div>
	);
}

function CoverThumbnail({
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
			<div className="flex h-[60px] w-[40px] shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
				<BookOpen className="size-5 opacity-40" />
			</div>
		);
	}

	return (
		<img
			src={`/api/covers/${bookId}`}
			alt={title}
			className="h-[60px] w-[40px] shrink-0 rounded object-cover"
			onError={() => setImgError(true)}
		/>
	);
}

function ReadingListBrowsePage(): JSX.Element {
	const { listId } = Route.useParams();
	const listIdNum = Number(listId);
	const router = useRouter();
	const queryClient = useQueryClient();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [localBooks, setLocalBooks] = useState<ReadingListBook[] | null>(null);

	const { data: readingLists, isLoading: isListLoading } = useQuery({
		queryKey: queryKeys.readingLists.list(),
		queryFn: async () => getReadingListsFn(),
		enabled: !Number.isNaN(listIdNum),
	});

	const readingList = readingLists?.find((l) => l.id === listIdNum);

	const { data: fetchedBooks, isLoading: isBooksLoading } = useQuery({
		queryKey: queryKeys.readingLists.books(listIdNum),
		queryFn: () =>
			getReadingListBooksFn({ data: { readingListId: listIdNum } }),
		enabled: !Number.isNaN(listIdNum),
	});

	// Use localBooks if we've done a reorder, otherwise use fetched
	const books = (localBooks ?? fetchedBooks ?? []) as ReadingListBook[];

	const deleteMutation = useMutation({
		mutationFn: () => deleteReadingListFn({ data: { id: listIdNum } }),
		onSuccess: async () => {
			toast.success("Reading list deleted");
			await queryClient.invalidateQueries({
				queryKey: queryKeys.readingLists.all,
			});
			router.history.back();
		},
		onError: (error: Error) => {
			toast.error(error.message ?? "Failed to delete reading list");
		},
	});

	const removeBookMutation = useMutation({
		mutationFn: (bookId: number) =>
			removeBookFromReadingListFn({
				data: { readingListId: listIdNum, bookId },
			}),
		onSuccess: async () => {
			toast.success("Book removed from reading list");
			setLocalBooks(null);
			await queryClient.invalidateQueries({
				queryKey: queryKeys.readingLists.books(listIdNum),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message ?? "Failed to remove book");
		},
	});

	const reorderMutation = useMutation({
		mutationFn: (bookIds: number[]) =>
			reorderReadingListFn({ data: { readingListId: listIdNum, bookIds } }),
		onError: (error: Error) => {
			toast.error(error.message ?? "Failed to reorder reading list");
			setLocalBooks(null);
		},
	});

	const handleMove = (index: number, direction: "up" | "down") => {
		const currentBooks = books;
		if (
			(direction === "up" && index === 0) ||
			(direction === "down" && index === currentBooks.length - 1)
		) {
			return;
		}

		const newBooks = [...currentBooks];
		const swapIndex = direction === "up" ? index - 1 : index + 1;
		[newBooks[index], newBooks[swapIndex]] = [
			newBooks[swapIndex],
			newBooks[index],
		];

		setLocalBooks(newBooks);
		reorderMutation.mutate(newBooks.map((b) => b.id));
	};

	if (isListLoading) {
		return <ReadingListPageSkeleton />;
	}

	if (!readingList) {
		return (
			<div className="flex h-40 items-center justify-center text-muted-foreground">
				Reading list not found
			</div>
		);
	}

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
				<h1 className="text-2xl font-bold">{readingList.name}</h1>
				<p className="text-sm text-muted-foreground">
					{books.length} {books.length === 1 ? "book" : "books"}
				</p>
			</div>

			{/* Actions */}
			<div className="flex gap-2">
				<ReadingListForm
					readingList={{ id: readingList.id, name: readingList.name }}
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

			{/* Ordered book list */}
			{isBooksLoading && (
				<div className="flex flex-col gap-2">
					{Array.from({ length: 4 }, (_, i) => `skeleton-${i}`).map((key) => (
						<Skeleton key={key} className="h-20 w-full rounded-md" />
					))}
				</div>
			)}
			{!isBooksLoading && books.length === 0 && (
				<div className="flex h-40 items-center justify-center text-muted-foreground">
					No books in this reading list
				</div>
			)}
			{!isBooksLoading && books.length > 0 && (
				<ol className="flex flex-col gap-2">
					{books.map((book, index) => (
						<li
							key={book.id}
							className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
						>
							{/* Position number */}
							<span className="w-6 shrink-0 text-center text-sm font-medium text-muted-foreground">
								{index + 1}
							</span>

							{/* Cover thumbnail */}
							<Link
								to="/books/$bookId"
								params={{ bookId: String(book.id) }}
								className="shrink-0"
							>
								<CoverThumbnail
									bookId={book.id}
									coverPath={book.coverPath}
									title={book.title}
								/>
							</Link>

							{/* Title */}
							<div className="min-w-0 flex-1">
								<Link
									to="/books/$bookId"
									params={{ bookId: String(book.id) }}
									className="line-clamp-2 text-sm font-medium hover:underline"
								>
									{book.title}
								</Link>
							</div>

							{/* Reorder + remove controls */}
							<div className="flex shrink-0 items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									disabled={index === 0}
									onClick={() => handleMove(index, "up")}
									aria-label="Move up"
								>
									<ChevronUp className="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									disabled={index === books.length - 1}
									onClick={() => handleMove(index, "down")}
									aria-label="Move down"
								>
									<ChevronDown className="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="size-7 text-muted-foreground hover:text-destructive"
									onClick={() => removeBookMutation.mutate(book.id)}
									aria-label="Remove from reading list"
								>
									<X className="size-4" />
								</Button>
							</div>
						</li>
					))}
				</ol>
			)}

			{/* Delete confirmation dialog */}
			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete Reading List</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						Are you sure you want to delete &ldquo;{readingList.name}&rdquo;?
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
