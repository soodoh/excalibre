import type { JSX } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { SidebarTrigger } from "src/components/ui/sidebar";
import { Separator } from "src/components/ui/separator";
import { Button } from "src/components/ui/button";

export default function Header(): JSX.Element {
  return (
    <header className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <Link to="/search">
        <Button variant="ghost" size="icon" aria-label="Search">
          <Search className="size-4" />
        </Button>
      </Link>
    </header>
  );
}
