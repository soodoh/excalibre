import type { JSX } from "react";
import { BookOpen, Home, Library, Settings } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { signOut, useSession } from "src/lib/auth-client";
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
import { Button } from "src/components/ui/button";
import { getLibrariesFn } from "src/server/libraries";
import { queryKeys } from "src/lib/query-keys";

export default function AppSidebar(): JSX.Element {
  const { data: session } = useSession();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const { data: libraries } = useQuery({
    queryKey: queryKeys.libraries.list(),
    queryFn: async () => getLibrariesFn(),
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

        {session?.user.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath.startsWith("/settings")}
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
