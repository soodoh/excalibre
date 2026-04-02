import type { JSX } from "react";
import { Skeleton } from "src/components/ui/skeleton";
import BookCard from "./book-card";

type BookItem = {
	id: number;
	title: string;
	coverPath: string | null;
	authorName?: string;
};

type BookGridProps = {
	books: BookItem[];
	isLoading: boolean;
};

const SKELETON_COUNT = 12;
const SKELETON_KEYS = Array.from(
	{ length: SKELETON_COUNT },
	(_, i) => `skeleton-${i}`,
);

export default function BookGrid({
	books,
	isLoading,
}: BookGridProps): JSX.Element {
	if (isLoading) {
		return (
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{SKELETON_KEYS.map((key) => (
					<div key={key} className="flex flex-col gap-2 p-1">
						<Skeleton className="aspect-[2/3] w-full rounded-md" />
						<Skeleton className="h-4 w-3/4 rounded" />
						<Skeleton className="h-3 w-1/2 rounded" />
					</div>
				))}
			</div>
		);
	}

	if (books.length === 0) {
		return (
			<div className="flex h-40 items-center justify-center text-muted-foreground">
				No books found
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{books.map((book) => (
				<BookCard
					key={book.id}
					id={book.id}
					title={book.title}
					coverPath={book.coverPath}
					authorName={book.authorName}
				/>
			))}
		</div>
	);
}
