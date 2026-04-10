import { createRef } from "react";
import type { ReaderSettings } from "src/hooks/use-reader-settings";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

// Mock react-pdf — it requires pdf.js worker setup which fails in test
vi.mock("react-pdf", () => ({
	Document: ({
		children,
		onLoadSuccess,
		loading,
		error: _error,
	}: {
		children: React.ReactNode;
		file: string;
		onLoadSuccess?: (data: { numPages: number }) => void;
		loading?: React.ReactNode;
		error?: React.ReactNode;
	}) => {
		// Simulate a loaded PDF with 10 pages on mount
		if (onLoadSuccess) {
			setTimeout(() => onLoadSuccess({ numPages: 10 }), 0);
		}
		return <div data-testid="pdf-document">{children}</div>;
	},
	Page: ({
		pageNumber,
	}: {
		pageNumber: number;
		renderTextLayer?: boolean;
		renderAnnotationLayer?: boolean;
		scale?: number;
	}) => <div data-testid="pdf-page">Page {pageNumber}</div>,
	pdfjs: {
		GlobalWorkerOptions: { workerSrc: "" },
	},
}));

// Mock the CSS imports
vi.mock("react-pdf/dist/Page/AnnotationLayer.css", () => ({}));
vi.mock("react-pdf/dist/Page/TextLayer.css", () => ({}));

import type { PdfReaderHandle } from "./pdf-reader";
import { PdfReader } from "./pdf-reader";

const DEFAULT_SETTINGS: ReaderSettings = {
	fontSize: 18,
	fontFamily: "Georgia, serif",
	lineHeight: 1.6,
	theme: "dark",
	layout: "paginated",
	margin: 48,
};

describe("PdfReader", () => {
	test("renders the PDF document container", async () => {
		const screen = await render(
			<PdfReader
				fileId={1}
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={vi.fn()}
			/>,
		);

		const doc = screen.container.querySelector("[data-testid='pdf-document']");
		expect(doc).not.toBeNull();
	});

	test("renders the current page", async () => {
		const screen = await render(
			<PdfReader
				fileId={1}
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={vi.fn()}
			/>,
		);

		const pageEl = screen.container.querySelector("[data-testid='pdf-page']");
		expect(pageEl).not.toBeNull();
		expect(pageEl?.textContent).toBe("Page 1");
	});

	test("shows page counter after load", async () => {
		const screen = await render(
			<PdfReader
				fileId={1}
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={vi.fn()}
			/>,
		);

		// Wait for the simulated onLoadSuccess to fire
		await expect.element(screen.getByText("Page 1 of 10")).toBeVisible();
	});

	test("exposes imperative handle via ref", async () => {
		const ref = createRef<PdfReaderHandle>();

		await render(
			<PdfReader
				ref={ref}
				fileId={1}
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={vi.fn()}
			/>,
		);

		expect(ref.current).not.toBeNull();
		expect(typeof ref.current?.next).toBe("function");
		expect(typeof ref.current?.prev).toBe("function");
		expect(typeof ref.current?.goTo).toBe("function");
	});

	test("calls onTocAvailable with empty array on load", async () => {
		const onTocAvailable = vi.fn();

		const screen = await render(
			<PdfReader
				fileId={1}
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={onTocAvailable}
			/>,
		);

		// Wait for the page counter to appear (indicates load happened)
		await expect.element(screen.getByText("Page 1 of 10")).toBeVisible();
		expect(onTocAvailable).toHaveBeenCalledWith([]);
	});

	test("calls onRelocate after load", async () => {
		const onRelocate = vi.fn();

		const screen = await render(
			<PdfReader
				fileId={1}
				settings={DEFAULT_SETTINGS}
				onRelocate={onRelocate}
				onTocAvailable={vi.fn()}
			/>,
		);

		// Wait for the page counter
		await expect.element(screen.getByText("Page 1 of 10")).toBeVisible();
		expect(onRelocate).toHaveBeenCalledWith({
			fraction: 0.1,
			position: "1",
			chapterTitle: "Page 1 of 10",
		});
	});

	test("starts at initialPosition page", async () => {
		const screen = await render(
			<PdfReader
				fileId={1}
				initialPosition="5"
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={vi.fn()}
			/>,
		);

		const pageEl = screen.container.querySelector("[data-testid='pdf-page']");
		expect(pageEl?.textContent).toBe("Page 5");
	});
});
