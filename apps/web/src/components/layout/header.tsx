import type { JSX } from "react";
import { SidebarTrigger } from "src/components/ui/sidebar";
import { Separator } from "src/components/ui/separator";

export default function Header(): JSX.Element {
  return (
    <header className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
    </header>
  );
}
