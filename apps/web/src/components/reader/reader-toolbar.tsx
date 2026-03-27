import type { JSX } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Settings2, Bookmark } from "lucide-react";
import { Button } from "src/components/ui/button";
import { cn } from "src/lib/utils";

type ReaderToolbarProps = {
  bookId: number;
  bookTitle: string;
  chapterTitle?: string;
  onToggleToc: () => void;
  onToggleSettings: () => void;
  visible: boolean;
};

export function ReaderToolbar({
  bookId,
  bookTitle,
  chapterTitle,
  onToggleToc,
  onToggleSettings,
  visible,
}: ReaderToolbarProps): JSX.Element {
  return (
    <div
      className={cn(
        "fixed top-0 right-0 left-0 z-60 flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-sm transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
      )}
    >
      {/* Back button */}
      <Link to="/books/$bookId" params={{ bookId: String(bookId) }}>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-white hover:bg-white/20 hover:text-white"
        >
          <ArrowLeft className="size-5" />
          <span className="sr-only">Back to book details</span>
        </Button>
      </Link>

      {/* Title area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-white">
          {bookTitle}
        </span>
        {chapterTitle && (
          <span className="truncate text-xs text-white/60">{chapterTitle}</span>
        )}
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 hover:text-white"
          onClick={onToggleToc}
        >
          <BookOpen className="size-5" />
          <span className="sr-only">Table of contents</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 hover:text-white"
          onClick={onToggleSettings}
        >
          <Settings2 className="size-5" />
          <span className="sr-only">Reader settings</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 hover:text-white"
        >
          <Bookmark className="size-5" />
          <span className="sr-only">Bookmark</span>
        </Button>
      </div>
    </div>
  );
}
