import type { JSX } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "src/components/ui/sheet";
import { cn } from "src/lib/utils";

export type TocItem = {
  label: string;
  href: string;
  subitems?: TocItem[];
};

type TocItemRowProps = {
  item: TocItem;
  depth: number;
  currentHref?: string;
  onSelect: (href: string) => void;
};

function TocItemRow({
  item,
  depth,
  currentHref,
  onSelect,
}: TocItemRowProps): JSX.Element {
  const isActive = item.href === currentHref;

  return (
    <>
      <button
        type="button"
        className={cn(
          "w-full rounded-sm px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
          isActive && "bg-accent font-medium text-accent-foreground",
          depth > 0 && "text-muted-foreground",
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(item.href)}
      >
        {item.label}
      </button>

      {item.subitems?.map((sub) => (
        <TocItemRow
          key={sub.href}
          item={sub}
          depth={depth + 1}
          currentHref={currentHref}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

type TocDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toc: TocItem[];
  currentHref?: string;
  onSelect: (href: string) => void;
};

export function TocDrawer({
  open,
  onOpenChange,
  toc,
  currentHref,
  onSelect,
}: TocDrawerProps): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Table of Contents</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-2">
          {toc.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No table of contents available.
            </p>
          ) : (
            toc.map((item) => (
              <TocItemRow
                key={item.href}
                item={item}
                depth={0}
                currentHref={currentHref}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
