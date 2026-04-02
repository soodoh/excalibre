// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-return

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { JSX, Ref } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EbookReaderHandle } from "src/components/reader/ebook-reader";
import { EbookReader } from "src/components/reader/ebook-reader";
import type { PdfReaderHandle } from "src/components/reader/pdf-reader";
import { PdfReader } from "src/components/reader/pdf-reader";
import { ReaderProgressBar } from "src/components/reader/reader-progress-bar";
import { ReaderSettingsPanel } from "src/components/reader/reader-settings";
import { ReaderToolbar } from "src/components/reader/reader-toolbar";
import type { TocItem } from "src/components/reader/toc-drawer";
import { TocDrawer } from "src/components/reader/toc-drawer";
import { Skeleton } from "src/components/ui/skeleton";
import { useReaderSettings } from "src/hooks/use-reader-settings";
import { useReadingProgress } from "src/hooks/use-reading-progress";
import { queryKeys } from "src/lib/query-keys";
import { getBookDetailFn } from "src/server/books";

export const Route = createFileRoute("/_authed/read/$bookId/$fileId")({
	component: ReaderPage,
});

type ReaderHandle = EbookReaderHandle | PdfReaderHandle;

const PDF_FORMAT = "pdf";

function ReaderPage(): JSX.Element {
	const params = Route.useParams() as { bookId: string; fileId: string };
	const bookIdStr = params.bookId;
	const fileIdStr = params.fileId;
	const bookId = Number(bookIdStr);
	const fileId = Number(fileIdStr);
	const navigate = useNavigate();

	// Book data
	const { data: bookData, isLoading } = useQuery({
		queryKey: queryKeys.books.detail(bookId),
		queryFn: () => getBookDetailFn({ data: { id: bookId } }),
		enabled: !Number.isNaN(bookId),
	});

	const book = bookData as
		| { title: string; files: Array<{ id: number; format: string }> }
		| undefined;

	// Determine format
	const file = book?.files.find((f) => f.id === fileId);
	const isPdf = file?.format === PDF_FORMAT;

	// Reading progress
	const { initialPosition, saveProgress, isSaving } =
		useReadingProgress(bookId);

	// Reader settings
	const { settings, updateSettings, resetSettings } = useReaderSettings();

	// UI state
	const [tocOpen, setTocOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [toolbarVisible, setToolbarVisible] = useState(true);

	// Reader state
	const [fraction, setFraction] = useState(0);
	const [chapterTitle, setChapterTitle] = useState<string | undefined>();
	const [currentHref, setCurrentHref] = useState<string | undefined>();
	const [toc, setToc] = useState<TocItem[]>([]);
	const [positionLabel, setPositionLabel] = useState("");

	// Refs
	const readerRef = useRef<ReaderHandle>(null);
	const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

	// Auto-hide toolbar
	const showToolbar = useCallback(() => {
		setToolbarVisible(true);
		if (hideTimerRef.current) {
			clearTimeout(hideTimerRef.current);
		}
		hideTimerRef.current = setTimeout(() => {
			setToolbarVisible(false);
		}, 3000);
	}, []);

	// Start auto-hide timer on mount
	useEffect(() => {
		showToolbar();
		return () => {
			if (hideTimerRef.current) {
				clearTimeout(hideTimerRef.current);
			}
		};
	}, [showToolbar]);

	// Keyboard navigation
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "ArrowRight") {
				readerRef.current?.next();
			} else if (e.key === "ArrowLeft") {
				readerRef.current?.prev();
			} else if (e.key === "Escape") {
				void navigate({
					to: "/books/$bookId",
					params: { bookId: bookIdStr },
				});
			}
		}

		globalThis.addEventListener("keydown", handleKeyDown);
		return () => {
			globalThis.removeEventListener("keydown", handleKeyDown);
		};
	}, [navigate, bookIdStr]);

	// Relocate handler (ebook)
	const handleRelocate = useCallback(
		(data: {
			fraction: number;
			position: string;
			tocItem?: { label: string; href: string };
			chapterTitle?: string;
		}) => {
			setFraction(data.fraction);
			if (data.chapterTitle) {
				setChapterTitle(data.chapterTitle);
			}
			if (data.tocItem?.href) {
				setCurrentHref(data.tocItem.href);
			}

			// Build position label
			const pct = Math.round(data.fraction * 100);
			const chapter = data.chapterTitle ?? data.tocItem?.label ?? "";
			setPositionLabel(chapter ? `${chapter} — ${pct}%` : `${pct}%`);

			// Save progress (debounced inside hook)
			saveProgress(data.fraction, data.position);
		},
		[saveProgress],
	);

	// Relocate handler (PDF)
	const handlePdfRelocate = useCallback(
		(data: { fraction: number; position: string; chapterTitle?: string }) => {
			setFraction(data.fraction);
			if (data.chapterTitle) {
				setChapterTitle(data.chapterTitle);
				setPositionLabel(data.chapterTitle);
			}
			saveProgress(data.fraction, data.position);
		},
		[saveProgress],
	);

	if (isLoading) {
		return (
			<div className="fixed inset-0 z-50 flex flex-col bg-background">
				<Skeleton className="h-14 w-full" />
				<div className="flex-1 p-8">
					<Skeleton className="h-full w-full" />
				</div>
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}

	return (
		<div
			role="application"
			className="fixed inset-0 z-50 flex flex-col bg-background"
			onMouseMove={showToolbar}
			onClick={showToolbar}
			onKeyDown={undefined}
		>
			<ReaderToolbar
				visible={toolbarVisible}
				bookId={bookId}
				bookTitle={book?.title ?? ""}
				chapterTitle={chapterTitle}
				onToggleToc={() => setTocOpen(true)}
				onToggleSettings={() => setSettingsOpen(true)}
			/>

			<div className="relative flex-1 overflow-hidden">
				{isPdf ? (
					<PdfReader
						ref={readerRef as Ref<PdfReaderHandle>}
						fileId={fileId}
						initialPosition={initialPosition}
						settings={settings}
						onRelocate={handlePdfRelocate}
						onTocAvailable={setToc}
					/>
				) : (
					<EbookReader
						ref={readerRef as Ref<EbookReaderHandle>}
						fileId={fileId}
						initialPosition={initialPosition}
						settings={settings}
						onRelocate={handleRelocate}
						onTocAvailable={setToc}
					/>
				)}
			</div>

			<ReaderProgressBar
				visible={toolbarVisible}
				fraction={fraction}
				positionLabel={positionLabel}
				isSaving={isSaving}
			/>

			<TocDrawer
				open={tocOpen}
				onOpenChange={setTocOpen}
				toc={toc}
				currentHref={currentHref}
				onSelect={(href) => {
					readerRef.current?.goTo(href);
					setTocOpen(false);
				}}
			/>

			<ReaderSettingsPanel
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				settings={settings}
				onUpdateSettings={updateSettings}
				onReset={resetSettings}
			/>
		</div>
	);
}
