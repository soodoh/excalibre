// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import BookGrid from "src/components/library/book-grid";
import { Input } from "src/components/ui/input";
import { Skeleton } from "src/components/ui/skeleton";
import { queryKeys } from "src/lib/query-keys";
import { searchFn } from "src/server/search";
import { z } from "zod";

const searchParamsSchema = z.object({
	q: z.string().optional().default(""),
});

export const Route = createFileRoute("/_authed/search")({
	validateSearch: searchParamsSchema,
	component: SearchPage,
});

type SearchBook = {
	id: number;
	title: string;
	coverPath: string | null;
	authorName?: string;
};

type SearchAuthor = {
	id: number;
	name: string;
};

type SearchSeries = {
	id: number;
	name: string;
};

type SearchResultsProps = {
	query: string;
	books: SearchBook[];
	authors: SearchAuthor[];
	seriesList: SearchSeries[];
	isLoading: boolean;
};

function SearchResultsSkeleton(): JSX.Element {
	return (
		<div className="flex flex-col gap-8">
			<section className="flex flex-col gap-3">
				<Skeleton className="h-6 w-24" />
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{Array.from({ length: 6 }, (_, i) => `skeleton-${i}`).map((key) => (
						<div key={key} className="flex flex-col gap-2 p-1">
							<Skeleton className="aspect-[2/3] w-full rounded-md" />
							<Skeleton className="h-4 w-3/4 rounded" />
							<Skeleton className="h-3 w-1/2 rounded" />
						</div>
					))}
				</div>
			</section>
		</div>
	);
}

function SearchResults({
	query,
	books,
	authors,
	seriesList,
	isLoading,
}: SearchResultsProps): JSX.Element {
	const hasResults =
		books.length > 0 || authors.length > 0 || seriesList.length > 0;

	if (isLoading) {
		return <SearchResultsSkeleton />;
	}

	if (!hasResults) {
		return (
			<div className="flex h-40 items-center justify-center text-muted-foreground">
				No results found for &ldquo;{query}&rdquo;
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-8">
			{books.length > 0 && (
				<section className="flex flex-col gap-3">
					<h2 className="text-lg font-semibold">
						Books{" "}
						<span className="text-sm font-normal text-muted-foreground">
							({books.length})
						</span>
					</h2>
					<BookGrid books={books} isLoading={false} />
				</section>
			)}

			{authors.length > 0 && (
				<section className="flex flex-col gap-3">
					<h2 className="text-lg font-semibold">
						Authors{" "}
						<span className="text-sm font-normal text-muted-foreground">
							({authors.length})
						</span>
					</h2>
					<div className="flex flex-wrap gap-2">
						{authors.map((author) => (
							<Link
								key={author.id}
								to="/authors/$authorId"
								params={{ authorId: String(author.id) }}
								className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
							>
								{author.name}
							</Link>
						))}
					</div>
				</section>
			)}

			{seriesList.length > 0 && (
				<section className="flex flex-col gap-3">
					<h2 className="text-lg font-semibold">
						Series{" "}
						<span className="text-sm font-normal text-muted-foreground">
							({seriesList.length})
						</span>
					</h2>
					<div className="flex flex-wrap gap-2">
						{seriesList.map((s) => (
							<Link
								key={s.id}
								to="/series/$seriesId"
								params={{ seriesId: String(s.id) }}
								className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
							>
								{s.name}
							</Link>
						))}
					</div>
				</section>
			)}
		</div>
	);
}

function SearchPage(): JSX.Element {
	const { q } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const [inputValue, setInputValue] = useState(q ?? "");
	const inputRef = useRef<HTMLInputElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	useEffect(() => {
		setInputValue(q ?? "");
	}, [q]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setInputValue(value);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		debounceRef.current = setTimeout(() => {
			void navigate({ search: { q: value }, replace: true });
		}, 300);
	};

	const query = q ?? "";
	const enabled = query.length >= 2;

	const { data: results, isLoading } = useQuery({
		queryKey: queryKeys.search.results(query),
		queryFn: () => searchFn({ data: { query, limit: 20 } }),
		enabled,
	});

	const books = (results?.books ?? []) as SearchBook[];
	const authors = (results?.authors ?? []) as SearchAuthor[];
	const seriesList = (results?.series ?? []) as SearchSeries[];

	return (
		<div className="flex flex-col gap-6">
			<div className="relative">
				<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					ref={inputRef}
					type="search"
					placeholder="Search for books, authors, or series..."
					className="pl-9 text-base"
					value={inputValue}
					onChange={handleInputChange}
				/>
			</div>

			{!enabled && (
				<div className="flex h-40 items-center justify-center text-muted-foreground">
					Search for books, authors, or series
				</div>
			)}

			{enabled && (
				<SearchResults
					query={query}
					books={books}
					authors={authors}
					seriesList={seriesList}
					isLoading={isLoading}
				/>
			)}
		</div>
	);
}
