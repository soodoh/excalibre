// oxlint-disable typescript/no-unsafe-call, typescript/no-unsafe-return

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LibraryBigIcon, ScanIcon } from "lucide-react";
import type { JSX } from "react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "src/components/ui/button";
import { queryKeys } from "src/lib/query-keys";
import { getLibrariesFn } from "src/server/libraries";
import { getAuthSessionFn } from "src/server/middleware";
import { triggerScanAllFn, triggerScanFn } from "src/server/scan-actions";

export const Route = createFileRoute("/_authed/settings/scanning")({
	beforeLoad: async () => {
		const session = await getAuthSessionFn();
		if (!session || session.user.role !== "admin") {
			// eslint-disable-next-line only-throw-error
			throw redirect({ to: "/" });
		}
	},
	component: ScanningSettingsPage,
});

type Library = {
	id: number;
	name: string;
	type: string;
	scanInterval: number;
	lastScannedAt?: Date | null;
};

type ScanResult = {
	added: number;
	updated: number;
	missing: number;
};

function formatRelativeTime(date: Date | null | undefined): string {
	if (!date) {
		return "Never";
	}

	const now = Date.now();
	const diffMs = now - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);

	if (diffSeconds < 60) {
		return "Just now";
	}

	const diffMinutes = Math.floor(diffSeconds / 60);
	if (diffMinutes < 60) {
		return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
	}

	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) {
		return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
	}

	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}

function LibraryRow({
	library,
	isScanningAll,
}: {
	library: Library;
	isScanningAll: boolean;
}): JSX.Element {
	const queryClient = useQueryClient();

	const scanMutation = useMutation({
		mutationFn: () => triggerScanFn({ data: { libraryId: library.id } }),
		onSuccess: async (result: ScanResult) => {
			toast.success(
				`Scan complete for "${library.name}": ${result.added} added, ${result.updated} updated, ${result.missing} missing`,
			);
			await queryClient.invalidateQueries({
				queryKey: queryKeys.libraries.all,
			});
		},
		onError: (error: Error) => {
			toast.error(error.message ?? `Failed to scan library "${library.name}"`);
		},
	});

	const isScanning = scanMutation.isPending || isScanningAll;

	return (
		<tr className="border-b last:border-0">
			<td className="px-4 py-3">
				<div className="flex items-center gap-2">
					<LibraryBigIcon className="h-4 w-4 text-muted-foreground" />
					<span className="font-medium">{library.name}</span>
				</div>
			</td>
			<td className="px-4 py-3 capitalize text-muted-foreground">
				{library.type}
			</td>
			<td className="px-4 py-3 text-muted-foreground">
				{library.scanInterval} min
			</td>
			<td className="px-4 py-3 text-muted-foreground">
				{formatRelativeTime(library.lastScannedAt)}
			</td>
			<td className="px-4 py-3 text-right">
				<Button
					variant="outline"
					size="sm"
					onClick={() => scanMutation.mutate()}
					disabled={isScanning}
				>
					<ScanIcon className="mr-1 h-3 w-3" />
					{scanMutation.isPending ? "Scanning..." : "Scan Now"}
				</Button>
			</td>
		</tr>
	);
}

function LibraryTableContent({
	isLoading,
	libraryList,
	isScanningAll,
}: {
	isLoading: boolean;
	libraryList: Library[];
	isScanningAll: boolean;
}): JSX.Element {
	if (isLoading) {
		return (
			<p className="text-sm text-muted-foreground">Loading libraries...</p>
		);
	}

	if (libraryList.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No libraries configured. Add a library in the Libraries settings.
			</p>
		);
	}

	return (
		<div className="rounded-md border">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b bg-muted/50">
						<th className="px-4 py-3 text-left font-medium">Library</th>
						<th className="px-4 py-3 text-left font-medium">Type</th>
						<th className="px-4 py-3 text-left font-medium">Scan Interval</th>
						<th className="px-4 py-3 text-left font-medium">Last Scanned</th>
						<th className="px-4 py-3 text-right font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{libraryList.map((library) => (
						<LibraryRow
							key={library.id}
							library={library}
							isScanningAll={isScanningAll}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}

function ScanningSettingsPage(): JSX.Element {
	const queryClient = useQueryClient();

	const { data: libraries, isLoading } = useQuery({
		queryKey: queryKeys.libraries.list(),
		queryFn: async () => getLibrariesFn(),
	});

	const scanAllMutation = useMutation({
		mutationFn: async () => triggerScanAllFn(),
		onSuccess: async (result: ScanResult) => {
			toast.success(
				`All libraries scanned: ${result.added} added, ${result.updated} updated, ${result.missing} missing`,
			);
			await queryClient.invalidateQueries({
				queryKey: queryKeys.libraries.all,
			});
		},
		onError: (error: Error) => {
			toast.error(error.message ?? "Failed to scan all libraries");
		},
	});

	const libraryList = useMemo(() => libraries ?? [], [libraries]);

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Scanning</h1>
					<p className="mt-2 text-muted-foreground">
						Configure scan intervals and trigger manual scans.
					</p>
				</div>
				<Button
					onClick={() => scanAllMutation.mutate()}
					disabled={scanAllMutation.isPending || libraryList.length === 0}
				>
					<ScanIcon className="mr-1 h-4 w-4" />
					{scanAllMutation.isPending ? "Scanning All..." : "Scan All Libraries"}
				</Button>
			</div>

			<div className="mt-6">
				<LibraryTableContent
					isLoading={isLoading}
					libraryList={libraryList}
					isScanningAll={scanAllMutation.isPending}
				/>
			</div>
		</div>
	);
}
