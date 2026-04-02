import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
	Bookmark,
	BookOpen,
	FolderOpen,
	Home,
	Library,
	Plus,
	RefreshCw,
	Settings,
	Sparkles,
} from "lucide-react";
import type { JSX } from "react";
import { CollectionForm } from "src/components/organization/collection-form";
import { ShelfForm } from "src/components/organization/shelf-form";
import { Button } from "src/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "src/components/ui/sidebar";
import { signOut, useSession } from "src/lib/auth-client";
import { queryKeys } from "src/lib/query-keys";
import { getCollectionsFn } from "src/server/collections";
import { getLibrariesFn } from "src/server/libraries";
import { getShelvesFn } from "src/server/shelves";

export default function AppSidebar(): JSX.Element {
	const { data: session } = useSession();
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;

	const { data: libraries } = useQuery({
		queryKey: queryKeys.libraries.list(),
		queryFn: async () => getLibrariesFn(),
	});

	const { data: shelves } = useQuery({
		queryKey: queryKeys.shelves.list(),
		queryFn: async () => getShelvesFn(),
	});

	const { data: collections } = useQuery({
		queryKey: queryKeys.collections.list(),
		queryFn: async () => getCollectionsFn(),
	});

	const handleSignOut = () => {
		void signOut();
	};

	return (
		<Sidebar>
			<SidebarHeader className="border-b border-sidebar-border px-4 py-3">
				<Link to="/" className="flex items-center gap-2">
					<BookOpen className="size-5" />
					<span className="font-semibold">Excalibre</span>
				</Link>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={currentPath === "/"}>
									<Link to="/">
										<Home className="size-4" />
										<span>Home</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Libraries</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{libraries && libraries.length > 0 ? (
								libraries.map((library) => (
									<SidebarMenuItem key={library.id}>
										<SidebarMenuButton
											asChild
											isActive={currentPath.startsWith(
												`/libraries/${library.id}`,
											)}
										>
											<Link
												to="/libraries/$libraryId"
												params={{ libraryId: String(library.id) }}
											>
												<Library className="size-4" />
												<span>{library.name}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))
							) : (
								<SidebarMenuItem>
									<div className="px-2 py-1 text-sm text-muted-foreground">
										<Library className="mb-1 inline size-4" /> No libraries yet
									</div>
								</SidebarMenuItem>
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Shelves */}
				<SidebarGroup>
					<div className="flex items-center justify-between pr-2">
						<SidebarGroupLabel>Shelves</SidebarGroupLabel>
						<ShelfForm
							trigger={
								<button
									type="button"
									className="rounded p-0.5 hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
									aria-label="New shelf"
								>
									<Plus className="size-3.5" />
								</button>
							}
						/>
					</div>
					<SidebarGroupContent>
						<SidebarMenu>
							{shelves && shelves.length > 0 ? (
								shelves.map((shelf) => (
									<SidebarMenuItem key={shelf.id}>
										<SidebarMenuButton
											asChild
											isActive={currentPath.startsWith(`/shelves/${shelf.id}`)}
										>
											<Link
												to="/shelves/$shelfId"
												params={{ shelfId: String(shelf.id) }}
											>
												{shelf.type === "smart" ? (
													<Sparkles className="size-4" />
												) : (
													<Bookmark className="size-4" />
												)}
												<span>{shelf.name}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))
							) : (
								<SidebarMenuItem>
									<div className="px-2 py-1 text-sm text-muted-foreground">
										No shelves
									</div>
								</SidebarMenuItem>
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Collections */}
				<SidebarGroup>
					<div className="flex items-center justify-between pr-2">
						<SidebarGroupLabel>Collections</SidebarGroupLabel>
						<CollectionForm
							trigger={
								<button
									type="button"
									className="rounded p-0.5 hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
									aria-label="New collection"
								>
									<Plus className="size-3.5" />
								</button>
							}
						/>
					</div>
					<SidebarGroupContent>
						<SidebarMenu>
							{collections && collections.length > 0 ? (
								collections.map((col) => (
									<SidebarMenuItem key={col.id}>
										<SidebarMenuButton
											asChild
											isActive={currentPath.startsWith(
												`/collections/${col.id}`,
											)}
										>
											<Link
												to="/collections/$collectionId"
												params={{ collectionId: String(col.id) }}
											>
												<FolderOpen className="size-4" />
												<span>{col.name}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))
							) : (
								<SidebarMenuItem>
									<div className="px-2 py-1 text-sm text-muted-foreground">
										No collections
									</div>
								</SidebarMenuItem>
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Account</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={currentPath === "/settings/sync"}
								>
									<Link to="/settings/sync">
										<RefreshCw className="size-4" />
										<span>Sync Services</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{session?.user.role === "admin" && (
					<SidebarGroup>
						<SidebarGroupLabel>Admin</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										isActive={
											currentPath.startsWith("/settings") &&
											currentPath !== "/settings/sync"
										}
									>
										<Link to="/settings/general">
											<Settings className="size-4" />
											<span>Settings</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>

			<SidebarFooter className="border-t border-sidebar-border p-4">
				<div className="flex flex-col gap-2">
					{session?.user.email && (
						<p className="truncate text-xs text-muted-foreground">
							{session.user.email}
						</p>
					)}
					<Button variant="outline" size="sm" onClick={handleSignOut}>
						Sign Out
					</Button>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
