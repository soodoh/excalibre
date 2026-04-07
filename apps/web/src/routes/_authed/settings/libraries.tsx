// oxlint-disable typescript/no-unsafe-call

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LibraryForm } from "src/components/settings/library-form";
import { Button } from "src/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "src/components/ui/dialog";
import { queryKeys } from "src/lib/query-keys";
import { deleteLibraryFn, getLibrariesFn } from "src/server/libraries";
import { getAuthSessionFn } from "src/server/middleware";

export const Route = createFileRoute("/_authed/settings/libraries")({
	beforeLoad: async () => {
		const session = await getAuthSessionFn();
		if (!session || session.user.role !== "admin") {
			// eslint-disable-next-line only-throw-error
			throw redirect({ to: "/" });
		}
	},
	component: LibrariesSettingsPage,
});

type Library = {
	id: number;
	name: string;
	type: string;
	scanPaths: string[];
	scanInterval: number;
	lastScannedAt?: Date | null;
};

function DeleteConfirmDialog({
	library,
	open,
	onClose,
}: {
	library: Library | null;
	open: boolean;
	onClose: () => void;
}): JSX.Element {
	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		mutationFn: async (id: number) => {
			await deleteLibraryFn({ data: { id } });
		},
		onSuccess: async () => {
			toast.success("Library deleted successfully");
			await queryClient.invalidateQueries({
				queryKey: queryKeys.libraries.all,
			});
			onClose();
		},
		onError: (error: Error) => {
			toast.error(error.message ?? "Failed to delete library");
		},
	});

	const handleConfirm = (): void => {
		if (library) {
			deleteMutation.mutate(library.id);
		}
	};

	const handleOpenChange = (isOpen: boolean): void => {
		if (!isOpen) {
			onClose();
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete Library</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-muted-foreground">
					Are you sure you want to delete{" "}
					<span className="font-medium text-foreground">{library?.name}</span>?
					This action cannot be undone.
				</p>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleConfirm}
						disabled={deleteMutation.isPending}
					>
						{deleteMutation.isPending ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function LibraryTable({
	libraries,
	onDeleteClick,
}: {
	libraries: Library[];
	onDeleteClick: (library: Library) => void;
}): JSX.Element {
	if (libraries.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No libraries yet. Add one to get started.
			</p>
		);
	}

	return (
		<div className="rounded-md border">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b bg-muted/50">
						<th className="px-4 py-3 text-left font-medium">Name</th>
						<th className="px-4 py-3 text-left font-medium">Type</th>
						<th className="px-4 py-3 text-left font-medium">Scan Paths</th>
						<th className="px-4 py-3 text-left font-medium">Last Scanned</th>
						<th className="px-4 py-3 text-right font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{libraries.map((library) => (
						<tr key={library.id} className="border-b last:border-0">
							<td className="px-4 py-3 font-medium">{library.name}</td>
							<td className="px-4 py-3 capitalize">{library.type}</td>
							<td className="px-4 py-3 text-muted-foreground">
								{library.scanPaths.length}{" "}
								{library.scanPaths.length === 1 ? "path" : "paths"}
							</td>
							<td className="px-4 py-3 text-muted-foreground">
								{library.lastScannedAt
									? library.lastScannedAt.toLocaleDateString()
									: "Never"}
							</td>
							<td className="px-4 py-3">
								<div className="flex justify-end gap-2">
									<LibraryForm
										library={{
											id: library.id,
											name: library.name,
											type: library.type,
											scanPaths: library.scanPaths,
											scanInterval: library.scanInterval,
										}}
										trigger={
											<Button variant="ghost" size="icon-sm">
												<PencilIcon />
												<span className="sr-only">Edit {library.name}</span>
											</Button>
										}
									/>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={() => onDeleteClick(library)}
									>
										<Trash2Icon className="text-destructive" />
										<span className="sr-only">Delete {library.name}</span>
									</Button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function LibrariesSettingsPage(): JSX.Element {
	const [libraryToDelete, setLibraryToDelete] = useState<Library | null>(null);

	const { data: libraries, isLoading } = useQuery({
		queryKey: queryKeys.libraries.list(),
		queryFn: async () => getLibrariesFn(),
	});

	const handleDeleteClick = (library: Library): void => {
		setLibraryToDelete(library);
	};

	const handleDeleteClose = (): void => {
		setLibraryToDelete(null);
	};

	const libraryList = useMemo(() => libraries ?? [], [libraries]);

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Libraries</h1>
					<p className="mt-2 text-muted-foreground">
						Manage your book libraries and scan paths.
					</p>
				</div>
				<LibraryForm
					trigger={
						<Button>
							<PlusIcon />
							Add Library
						</Button>
					}
				/>
			</div>

			<div className="mt-6">
				{isLoading ? (
					<p className="text-sm text-muted-foreground">Loading libraries...</p>
				) : (
					<LibraryTable
						libraries={libraryList}
						onDeleteClick={handleDeleteClick}
					/>
				)}
			</div>

			<DeleteConfirmDialog
				library={libraryToDelete}
				open={libraryToDelete !== null}
				onClose={handleDeleteClose}
			/>
		</div>
	);
}
