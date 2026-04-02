// oxlint-disable typescript/no-unsafe-call, typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-argument, typescript/no-unsafe-return

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import type { JSX } from "react";
import { toast } from "sonner";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "src/components/ui/dropdown-menu";
import { queryKeys } from "src/lib/query-keys";
import {
	addBookToCollectionFn,
	getCollectionsFn,
	removeBookFromCollectionFn,
} from "src/server/collections";
import {
	addBookToReadingListFn,
	getReadingListsFn,
	removeBookFromReadingListFn,
} from "src/server/reading-lists";
import {
	addBookToShelfFn,
	getBookMembershipFn,
	getShelvesFn,
	removeBookFromShelfFn,
} from "src/server/shelves";

type AddToShelfProps = {
	bookId: number;
	trigger: React.ReactNode;
};

export function AddToShelf({ bookId, trigger }: AddToShelfProps): JSX.Element {
	const queryClient = useQueryClient();

	const { data: shelves } = useQuery({
		queryKey: queryKeys.shelves.list(),
		queryFn: async () => getShelvesFn(),
	});

	const { data: collections } = useQuery({
		queryKey: queryKeys.collections.list(),
		queryFn: async () => getCollectionsFn(),
	});

	const { data: readingLists } = useQuery({
		queryKey: queryKeys.readingLists.list(),
		queryFn: async () => getReadingListsFn(),
	});

	const membershipKey = ["bookMembership", bookId] as const;
	const { data: membership } = useQuery({
		queryKey: membershipKey,
		queryFn: () => getBookMembershipFn({ data: { bookId } }),
	});

	const manualShelves = shelves?.filter((s) => s.type === "manual") ?? [];
	const shelfIds = membership
		? new Set(membership.shelfIds)
		: new Set<number>();
	const collectionIds = membership
		? new Set(membership.collectionIds)
		: new Set<number>();
	const readingListIds = membership
		? new Set(membership.readingListIds)
		: new Set<number>();

	const invalidateMembership = async () => {
		await queryClient.invalidateQueries({ queryKey: membershipKey });
	};

	const handleShelfToggle = async (shelfId: number, inShelf: boolean) => {
		try {
			if (inShelf) {
				await removeBookFromShelfFn({ data: { shelfId, bookId } });
				toast.success("Removed from shelf");
			} else {
				await addBookToShelfFn({ data: { shelfId, bookId } });
				toast.success("Added to shelf");
			}
			await invalidateMembership();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Something went wrong",
			);
		}
	};

	const handleCollectionToggle = async (
		collectionId: number,
		inCollection: boolean,
	) => {
		try {
			if (inCollection) {
				await removeBookFromCollectionFn({ data: { collectionId, bookId } });
				toast.success("Removed from collection");
			} else {
				await addBookToCollectionFn({ data: { collectionId, bookId } });
				toast.success("Added to collection");
			}
			await invalidateMembership();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Something went wrong",
			);
		}
	};

	const handleReadingListToggle = async (
		readingListId: number,
		inList: boolean,
	) => {
		try {
			if (inList) {
				await removeBookFromReadingListFn({ data: { readingListId, bookId } });
				toast.success("Removed from reading list");
			} else {
				await addBookToReadingListFn({ data: { readingListId, bookId } });
				toast.success("Added to reading list");
			}
			await invalidateMembership();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Something went wrong",
			);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				{/* Shelves section */}
				<DropdownMenuLabel>Shelves</DropdownMenuLabel>
				{manualShelves.length === 0 ? (
					<DropdownMenuItem disabled>No shelves</DropdownMenuItem>
				) : (
					manualShelves.map((shelf) => {
						const inShelf = shelfIds.has(shelf.id);
						return (
							<DropdownMenuItem
								key={shelf.id}
								onSelect={(e) => {
									e.preventDefault();
									void handleShelfToggle(shelf.id, inShelf);
								}}
								className="flex items-center justify-between"
							>
								<span>{shelf.name}</span>
								{inShelf && <CheckIcon className="size-4 text-primary" />}
							</DropdownMenuItem>
						);
					})
				)}

				<DropdownMenuSeparator />

				{/* Collections section */}
				<DropdownMenuLabel>Collections</DropdownMenuLabel>
				{(collections ?? []).length === 0 ? (
					<DropdownMenuItem disabled>No collections</DropdownMenuItem>
				) : (
					(collections ?? []).map((col) => {
						const inCollection = collectionIds.has(col.id);
						return (
							<DropdownMenuItem
								key={col.id}
								onSelect={(e) => {
									e.preventDefault();
									void handleCollectionToggle(col.id, inCollection);
								}}
								className="flex items-center justify-between"
							>
								<span>{col.name}</span>
								{inCollection && <CheckIcon className="size-4 text-primary" />}
							</DropdownMenuItem>
						);
					})
				)}

				<DropdownMenuSeparator />

				{/* Reading Lists section */}
				<DropdownMenuLabel>Reading Lists</DropdownMenuLabel>
				{(readingLists ?? []).length === 0 ? (
					<DropdownMenuItem disabled>No reading lists</DropdownMenuItem>
				) : (
					(readingLists ?? []).map((list) => {
						const inList = readingListIds.has(list.id);
						return (
							<DropdownMenuItem
								key={list.id}
								onSelect={(e) => {
									e.preventDefault();
									void handleReadingListToggle(list.id, inList);
								}}
								className="flex items-center justify-between"
							>
								<span>{list.name}</span>
								{inList && <CheckIcon className="size-4 text-primary" />}
							</DropdownMenuItem>
						);
					})
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
