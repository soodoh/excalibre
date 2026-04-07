// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-return

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { JSX } from "react";
import { useState } from "react";
import BookGrid from "src/components/library/book-grid";
import { Skeleton } from "src/components/ui/skeleton";
import { useSession } from "src/lib/auth-client";
import { queryKeys } from "src/lib/query-keys";
import { getRecentBooksFn } from "src/server/books";
import { getContinueReadingFn } from "src/server/search";

export const Route = createFileRoute("/_authed/")({
	component: HomePage,
});

type ContinueReadingBook = {
	id: number;
	title: string;
	coverPath: string | null;
	progress: number | null;
};

function ContinueReadingCard({
	book,
}: {
	book: ContinueReadingBook;
}): JSX.Element {
	const [imgError, setImgError] = useState(false);
	const progress = book.progress ?? 0;
	const percent = Math.round(progress * 100);

	return (
		<Link
			to="/books/$bookId"
			params={{ bookId: String(book.id) }}
			className="group flex flex-col gap-2 rounded-lg p-1 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-muted">
				{book.coverPath && !imgError ? (
					<img
						src={`/api/covers/${book.id}`}
						alt={book.title}
						className="h-full w-full object-cover"
						onError={() => setImgError(true)}
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
						<span className="text-2xl opacity-40">📖</span>
					</div>
				)}
				<div className="absolute inset-0 rounded-md ring-1 ring-inset ring-black/10 group-hover:ring-primary/30 transition-all" />
			</div>
			<div className="flex flex-col gap-1 px-0.5">
				<p className="line-clamp-2 text-sm font-medium leading-snug">
					{book.title}
				</p>
				<div className="flex items-center gap-1.5">
					<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all"
							style={{ width: `${percent}%` }}
						/>
					</div>
					<span className="text-xs text-muted-foreground">{percent}%</span>
				</div>
			</div>
		</Link>
	);
}

function ContinueReadingSection(): JSX.Element {
	const { data: continueBooks, isLoading } = useQuery({
		queryKey: queryKeys.continueReading.list(),
		queryFn: () => getContinueReadingFn({ data: { limit: 6 } }),
	});

	const books = (continueBooks ?? []) as ContinueReadingBook[];

	if (isLoading) {
		return (
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{Array.from({ length: 6 }, (_, i) => `skeleton-${i}`).map((key) => (
					<div key={key} className="flex flex-col gap-2 p-1">
						<Skeleton className="aspect-[2/3] w-full rounded-md" />
						<Skeleton className="h-4 w-3/4 rounded" />
						<Skeleton className="h-2 w-full rounded-full" />
					</div>
				))}
			</div>
		);
	}

	if (books.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				Start reading a book to see it here
			</p>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{books.map((book) => (
				<ContinueReadingCard key={book.id} book={book} />
			))}
		</div>
	);
}

function HomePage(): JSX.Element {
	const { data: session } = useSession();
	const sessionUser = session?.user as { role?: "admin" | "user" } | undefined;
	const isAdmin = sessionUser?.role === "admin";

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
			{/* Continue Reading */}
			<section className="flex flex-col gap-3">
				<h2 className="text-xl font-semibold">Continue Reading</h2>
				<ContinueReadingSection />
			</section>

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
		</div>
	);
}
