import type { Ref } from "react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
// eslint-disable-next-line import/no-unassigned-import
import "react-pdf/dist/Page/AnnotationLayer.css";
// eslint-disable-next-line import/no-unassigned-import
import "react-pdf/dist/Page/TextLayer.css";
import type { ReaderSettings } from "src/hooks/use-reader-settings";

// Set up the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

export type PdfReaderHandle = {
	next: () => void;
	prev: () => void;
	goTo: (target: string) => void;
};

type PdfReaderProps = {
	fileId: number;
	initialPosition?: string;
	settings: ReaderSettings;
	onRelocate: (data: {
		fraction: number;
		position: string;
		chapterTitle?: string;
	}) => void;
	onTocAvailable: (toc: Array<{ label: string; href: string }>) => void;
};

export const PdfReader = forwardRef(function PdfReader(
	props: PdfReaderProps,
	ref: Ref<PdfReaderHandle>,
) {
	const { fileId, initialPosition, settings, onRelocate, onTocAvailable } =
		props;

	const [numPages, setNumPages] = useState(0);
	const [pageNumber, setPageNumber] = useState(
		initialPosition ? Number.parseInt(initialPosition, 10) : 1,
	);

	const fileUrl = `/api/books/${fileId}`;

	const goToPage = useCallback(
		(page: number) => {
			const clamped = Math.max(1, Math.min(numPages || 1, page));
			setPageNumber(clamped);
		},
		[numPages],
	);

	useImperativeHandle(ref, () => ({
		next: () => setPageNumber((p) => Math.min(numPages, p + 1)),
		prev: () => setPageNumber((p) => Math.max(1, p - 1)),
		goTo: (target: string) => {
			const page = Number.parseInt(target, 10);
			if (!Number.isNaN(page)) {
				goToPage(page);
			}
		},
	}));

	// Emit relocate whenever pageNumber or numPages change
	useEffect(() => {
		if (numPages === 0) {
			return;
		}
		onRelocate({
			fraction: pageNumber / numPages,
			position: String(pageNumber),
			chapterTitle: `Page ${pageNumber} of ${numPages}`,
		});
	}, [pageNumber, numPages, onRelocate]);

	function handleLoadSuccess({ numPages: total }: { numPages: number }) {
		setNumPages(total);
		// PDF files typically don't have a structured TOC available via react-pdf
		// so emit an empty TOC for now
		onTocAvailable([]);
	}

	const isDark = settings.theme === "dark";

	return (
		<div className="relative h-full w-full overflow-auto bg-muted flex flex-col items-center py-4">
			{numPages > 0 && (
				<div className="mb-2 text-xs text-muted-foreground">
					Page {pageNumber} of {numPages}
				</div>
			)}
			<div
				style={isDark ? { filter: "invert(1) hue-rotate(180deg)" } : undefined}
			>
				<Document
					file={fileUrl}
					onLoadSuccess={handleLoadSuccess}
					loading={
						<div className="flex h-64 w-48 items-center justify-center rounded-md bg-muted animate-pulse" />
					}
					error={
						<div className="flex h-64 w-48 items-center justify-center rounded-md bg-muted text-muted-foreground text-sm">
							Failed to load PDF
						</div>
					}
				>
					<Page
						pageNumber={pageNumber}
						renderTextLayer
						renderAnnotationLayer
						scale={1.2}
					/>
				</Document>
			</div>
		</div>
	);
});
