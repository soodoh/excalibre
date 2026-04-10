import { createRef } from "react";
import type { ReaderSettings } from "src/hooks/use-reader-settings";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

// Mock foliate-js — it registers custom elements and has no TS types
vi.mock("foliate-js/view.js", () => ({}));

import type { EbookReaderHandle } from "./ebook-reader";
import { EbookReader } from "./ebook-reader";

const DEFAULT_SETTINGS: ReaderSettings = {
	fontSize: 18,
	fontFamily: "Georgia, serif",
	lineHeight: 1.6,
	theme: "dark",
	layout: "paginated",
	margin: 48,
};

describe("EbookReader", () => {
	test("renders a container div", async () => {
		const screen = await render(
			<EbookReader
				fileId={1}
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={vi.fn()}
			/>,
		);

		// The component renders a div with class "h-full w-full"
		const container = screen.container.querySelector(".h-full.w-full");
		expect(container).not.toBeNull();
	});

	test("exposes imperative handle via ref", async () => {
		const ref = createRef<EbookReaderHandle>();

		await render(
			<EbookReader
				ref={ref}
				fileId={1}
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={vi.fn()}
			/>,
		);

		// The ref should expose next, prev, and goTo methods
		expect(ref.current).not.toBeNull();
		expect(typeof ref.current?.next).toBe("function");
		expect(typeof ref.current?.prev).toBe("function");
		expect(typeof ref.current?.goTo).toBe("function");
	});

	test("ref methods can be called without errors", async () => {
		const ref = createRef<EbookReaderHandle>();

		await render(
			<EbookReader
				ref={ref}
				fileId={1}
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={vi.fn()}
			/>,
		);

		// Calling methods when no foliate view is loaded should not throw
		expect(() => ref.current?.next()).not.toThrow();
		expect(() => ref.current?.prev()).not.toThrow();
		expect(() => ref.current?.goTo("#chapter-1")).not.toThrow();
	});

	test("accepts optional props", async () => {
		const screen = await render(
			<EbookReader
				fileId={5}
				initialPosition="epubcfi(/6/4)"
				settings={DEFAULT_SETTINGS}
				onRelocate={vi.fn()}
				onTocAvailable={vi.fn()}
				onTextSelected={vi.fn()}
			/>,
		);

		// Should render without error
		const container = screen.container.querySelector(".h-full.w-full");
		expect(container).not.toBeNull();
	});
});
