import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";

type BookCardProps = {
	id: number;
	title: string;
	coverPath: string | null;
	authorName?: string;
};

export default function BookCard({
	id,
	title,
	coverPath,
	authorName,
}: BookCardProps): JSX.Element {
	const [imgError, setImgError] = useState(false);

	return (
		<Link
			to="/books/$bookId"
			params={{ bookId: String(id) }}
			className="group flex flex-col gap-2 rounded-lg p-1 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-muted">
				{coverPath && !imgError ? (
					<img
						src={`/api/covers/${id}`}
						alt={title}
						className="h-full w-full object-cover"
						onError={() => setImgError(true)}
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
						<BookOpen className="size-10 opacity-40" />
					</div>
				)}
				<div className="absolute inset-0 rounded-md ring-1 ring-inset ring-black/10 group-hover:ring-primary/30 transition-all" />
			</div>
			<div className="flex flex-col gap-0.5 px-0.5">
				<p className="line-clamp-2 text-sm font-medium leading-snug">{title}</p>
				{authorName && (
					<p className="line-clamp-1 text-xs text-muted-foreground">
						{authorName}
					</p>
				)}
			</div>
		</Link>
	);
}
