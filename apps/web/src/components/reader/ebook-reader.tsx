import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import type { Ref } from "react";
import type { ReaderSettings } from "src/hooks/use-reader-settings";

// Track if foliate-js has been imported (custom elements can only register once)
let foliateImported = false;

export type EbookReaderHandle = {
  next: () => void;
  prev: () => void;
  goTo: (target: string) => void;
};

type TocItem = {
  label: string;
  href: string;
  subitems?: TocItem[];
};

type EbookReaderProps = {
  fileId: number;
  initialPosition?: string;
  settings: ReaderSettings;
  onRelocate: (data: {
    fraction: number;
    position: string;
    tocItem?: { label: string; href: string };
    chapterTitle?: string;
  }) => void;
  onTocAvailable: (toc: TocItem[]) => void;
  onTextSelected?: (data: { cfi: string; text: string }) => void;
};

// Minimal typed wrapper around the foliate-view custom element so we avoid
// sprinkling `any` casts throughout the component.
type FoliateRenderer = {
  setAttribute: (name: string, value: string) => void;
  setStyles?: (css: string) => void;
  destroy?: () => void;
};

type FoliateBook = {
  toc?: unknown[];
};

type FoliateTocItem = {
  label?: string;
  href?: string;
};

type FoliateRelocateDetail = {
  fraction?: number;
  cfi?: string;
  tocItem?: FoliateTocItem;
};

type FoliateView = HTMLElement & {
  renderer?: FoliateRenderer;
  book?: FoliateBook;
  open: (file: File) => Promise<void>;
  goTo: (target: string) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
};

function castToFoliateView(el: HTMLElement): FoliateView {
  return el as unknown as FoliateView;
}

function getRawToc(book: FoliateBook): unknown[] {
  return Array.isArray(book.toc) ? book.toc : [];
}

function normalizeTocItem(raw: unknown): TocItem {
  const item = raw as Record<string, unknown>;
  let label = "";
  if (typeof item.label === "string") {
    label = item.label;
  } else if (typeof item.title === "string") {
    label = item.title;
  }
  const href = typeof item.href === "string" ? item.href : "";
  const rawSubitems = item.subitems;
  const subitems =
    Array.isArray(rawSubitems) && rawSubitems.length > 0
      ? rawSubitems.map(normalizeTocItem)
      : undefined;
  return { label, href, ...(subitems ? { subitems } : {}) };
}

function normalizeToc(rawToc: unknown[]): TocItem[] {
  return rawToc.map(normalizeTocItem);
}

function applySettings(view: FoliateView, settings: ReaderSettings) {
  const renderer = view.renderer;
  if (!renderer) {
    return;
  }

  renderer.setAttribute("flow", settings.layout);
  renderer.setAttribute("margin", String(settings.margin));
  renderer.setAttribute("max-inline-size", "720");
  renderer.setAttribute("max-column-count", "1");
  renderer.setAttribute("animated", "");

  const isDark = settings.theme === "dark";
  const isSepia = settings.theme === "sepia";

  let themeStyles = "";
  if (isDark) {
    themeStyles = `
      :root, html, body {
        background-color: #1a1a1a !important;
        color: #d4d4d4 !important;
      }
    `;
  } else if (isSepia) {
    themeStyles = `
      :root, html, body {
        background-color: #f4ecd8 !important;
        color: #5b4636 !important;
      }
    `;
  }

  renderer.setStyles?.(`
    body {
      font-family: ${settings.fontFamily};
      font-size: ${settings.fontSize}px;
      line-height: ${settings.lineHeight};
    }
    ${themeStyles}
  `);
}

export const EbookReader = forwardRef(function EbookReader(
  props: EbookReaderProps,
  ref: Ref<EbookReaderHandle>,
) {
  const {
    fileId,
    initialPosition,
    settings,
    onRelocate,
    onTocAvailable,
    onTextSelected,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FoliateView | null>(null);

  useImperativeHandle(ref, () => ({
    next: () => {
      void viewRef.current?.next();
    },
    prev: () => {
      void viewRef.current?.prev();
    },
    goTo: (target: string) => {
      void viewRef.current?.goTo(target);
    },
  }));

  // Mount effect: import foliate-js, create the view, load the book
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let view: FoliateView | null = null;

    async function init() {
      // Import foliate-js once to register the custom element
      if (!foliateImported) {
        // foliate-js has no TypeScript declarations; dynamic import is fine.
        await import(
          // @ts-expect-error -- no types for foliate-js
          "foliate-js/view.js"
        );
        foliateImported = true;
      }

      if (cancelled) {
        return;
      }

      // Create the foliate-view custom element (DOM-only; not JSX)
      const el = document.createElement("foliate-view");
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.display = "block";
      // container is guaranteed non-null: guarded by the early-return above.
      // The ! assertion is needed because TypeScript loses narrowing across
      // async closure boundaries even though the value is captured before any
      // await.
      container!.append(el);
      view = castToFoliateView(el);
      viewRef.current = view;

      // Fetch book file as blob
      const response = await fetch(`/api/books/${fileId}`);
      if (!response.ok || cancelled) {
        return;
      }

      const blob = await response.blob();
      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      const file = new File([blob], `book-${fileId}`, { type: contentType });

      await view.open(file);
      if (cancelled) {
        return;
      }

      // Apply initial settings
      applySettings(view, settings);

      // Extract and emit TOC
      const rawToc = view.book ? getRawToc(view.book) : [];
      onTocAvailable(normalizeToc(rawToc));

      // Restore position
      if (initialPosition) {
        try {
          await view.goTo(initialPosition);
        } catch {
          // Position may be invalid for this book version; ignore
        }
      }

      // Capture view in local var so listeners can be removed on cleanup
      const activeView = view;

      const handleRelocate = (e: Event) => {
        const detail = (e as CustomEvent<FoliateRelocateDetail>).detail ?? {};
        const fraction = detail.fraction ?? 0;
        const cfi = detail.cfi ?? "";
        const rawTocItem = detail.tocItem;
        const tocItem = rawTocItem
          ? {
              label: rawTocItem.label ?? "",
              href: rawTocItem.href ?? "",
            }
          : undefined;
        onRelocate({
          fraction,
          position: cfi,
          tocItem,
          chapterTitle: tocItem?.label,
        });
      };

      activeView.addEventListener("relocate", handleRelocate);

      if (onTextSelected) {
        const handleCreateOverlay = (e: Event) => {
          const detail = (e as CustomEvent<{ cfi?: string }>).detail;
          const selection = document.getSelection();
          const selectedText = selection?.toString() ?? "";
          if (selectedText && detail?.cfi) {
            onTextSelected({ cfi: detail.cfi, text: selectedText });
          }
        };
        activeView.addEventListener("create-overlay", handleCreateOverlay);
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (view) {
        view.renderer?.destroy?.();
        view.remove();
        viewRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Re-apply settings whenever they change (after the view is ready)
  useEffect(() => {
    if (viewRef.current) {
      applySettings(viewRef.current, settings);
    }
  }, [settings]);

  return <div ref={containerRef} className="h-full w-full" />;
});
