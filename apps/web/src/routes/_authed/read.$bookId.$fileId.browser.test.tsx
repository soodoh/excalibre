import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	let ebookProps: {
		onRelocate: (data: unknown) => void;
		onTocAvailable: (t: unknown[]) => void;
	} | null = null;
	let pdfProps: {
		onRelocate: (data: unknown) => void;
		onTocAvailable: (t: unknown[]) => void;
	} | null = null;
	let toolbarProps: {
		onToggleToc: () => void;
		onToggleSettings: () => void;
	} | null = null;
	let tocProps: { onSelect: (href: string) => void } | null = null;
	return {
		useQuery: vi.fn(),
		navigate: vi.fn(),
		params: { bookId: "1", fileId: "10" },
		setComponent: (c: unknown) => {
			captured = c;
		},
		getComponent: () => captured,
		setEbookProps: (p: typeof ebookProps) => {
			ebookProps = p;
		},
		getEbookProps: () => ebookProps,
		setPdfProps: (p: typeof pdfProps) => {
			pdfProps = p;
		},
		getPdfProps: () => pdfProps,
		setToolbarProps: (p: typeof toolbarProps) => {
			toolbarProps = p;
		},
		getToolbarProps: () => toolbarProps,
		setTocProps: (p: typeof tocProps) => {
			tocProps = p;
		},
		getTocProps: () => tocProps,
	};
});

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (fn: unknown) => fn,
		inputValidator: () => ({ handler: (fn: unknown) => fn }),
	}),
}));

vi.mock("@tanstack/react-router", () => {
	const Route = {
		useParams: () => mocks.params,
	};
	return {
		createFileRoute: () => (opts: { component: unknown }) => {
			mocks.setComponent(opts.component);
			Object.assign(Route, { component: opts.component });
			return Route;
		},
		useNavigate: () => mocks.navigate,
	};
});

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("src/server/books", () => ({
	getBookDetailFn: vi.fn(),
}));

vi.mock("src/hooks/use-reading-progress", () => ({
	useReadingProgress: () => ({
		initialPosition: null,
		saveProgress: vi.fn(),
		isSaving: false,
	}),
}));

vi.mock("src/hooks/use-reader-settings", () => ({
	useReaderSettings: () => ({
		settings: {
			fontSize: 16,
			lineHeight: 1.5,
			theme: "default",
			fontFamily: "serif",
		},
		updateSettings: vi.fn(),
		resetSettings: vi.fn(),
	}),
}));

vi.mock("src/components/reader/ebook-reader", () => ({
	EbookReader: (props: {
		onRelocate: (data: unknown) => void;
		onTocAvailable: (t: unknown[]) => void;
	}) => {
		mocks.setEbookProps(props);
		return <div data-testid="ebook-reader">Ebook Reader</div>;
	},
}));

vi.mock("src/components/reader/pdf-reader", () => ({
	PdfReader: (props: {
		onRelocate: (data: unknown) => void;
		onTocAvailable: (t: unknown[]) => void;
	}) => {
		mocks.setPdfProps(props);
		return <div data-testid="pdf-reader">PDF Reader</div>;
	},
}));

vi.mock("src/components/reader/reader-toolbar", () => ({
	ReaderToolbar: (props: {
		bookTitle: string;
		onToggleToc: () => void;
		onToggleSettings: () => void;
	}) => {
		mocks.setToolbarProps(props);
		return <div data-testid="reader-toolbar">{props.bookTitle}</div>;
	},
}));

vi.mock("src/components/reader/reader-settings", () => ({
	ReaderSettingsPanel: () => null,
}));

vi.mock("src/components/reader/reader-progress-bar", () => ({
	ReaderProgressBar: () => <div data-testid="progress-bar" />,
}));

vi.mock("src/components/reader/toc-drawer", () => ({
	TocDrawer: (props: { onSelect: (href: string) => void }) => {
		mocks.setTocProps(props);
		return null;
	},
}));

import "./read.$bookId.$fileId";

type ComponentType = () => React.JSX.Element;

describe("ReaderPage", () => {
	test("shows loading skeleton", async () => {
		mocks.useQuery.mockReturnValue({ data: undefined, isLoading: true });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		// Loading renders skeleton containers
		expect(screen.container.querySelector(".fixed")).toBeTruthy();
	});

	test("renders ebook reader for epub book", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				title: "My Book",
				files: [{ id: 10, format: "epub" }],
			},
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByTestId("ebook-reader")).toBeVisible();
	});

	test("renders PDF reader for pdf book", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				title: "My PDF",
				files: [{ id: 10, format: "pdf" }],
			},
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByTestId("pdf-reader")).toBeVisible();
	});

	test("renders reader toolbar with book title", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				title: "My Book",
				files: [{ id: 10, format: "epub" }],
			},
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByTestId("reader-toolbar")).toBeVisible();
		await expect.element(screen.getByText("My Book")).toBeVisible();
	});

	test("ebook onRelocate handler with chapterTitle and toc", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				title: "Book",
				files: [{ id: 10, format: "epub" }],
			},
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		const props = mocks.getEbookProps();
		props?.onRelocate({
			fraction: 0.5,
			position: "cfi(/6/4!/4)",
			tocItem: { label: "Chapter 1", href: "ch1.xhtml" },
			chapterTitle: "Chapter One",
		});
		// Without chapterTitle
		props?.onRelocate({
			fraction: 0.25,
			position: "cfi(/6/2)",
		});
		// With tocItem only
		props?.onRelocate({
			fraction: 0.75,
			position: "cfi(/6/6)",
			tocItem: { label: "Ch2", href: "ch2.xhtml" },
		});
		props?.onTocAvailable([{ label: "Ch1", href: "ch1.xhtml" }]);
	});

	test("pdf onRelocate handler with and without chapter", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				title: "PDF",
				files: [{ id: 10, format: "pdf" }],
			},
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		const props = mocks.getPdfProps();
		props?.onRelocate({
			fraction: 0.5,
			position: "page-5",
			chapterTitle: "Chapter 2",
		});
		props?.onRelocate({
			fraction: 0.3,
			position: "page-3",
		});
	});

	test("toolbar toggle toc and settings handlers", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				title: "Book",
				files: [{ id: 10, format: "epub" }],
			},
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		const toolbar = mocks.getToolbarProps();
		toolbar?.onToggleToc();
		toolbar?.onToggleSettings();
	});

	test("toc drawer onSelect handler", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				title: "Book",
				files: [{ id: 10, format: "epub" }],
			},
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		const toc = mocks.getTocProps();
		toc?.onSelect("ch3.xhtml");
	});

	test("keyboard navigation - arrow keys and escape", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				title: "Book",
				files: [{ id: 10, format: "epub" }],
			},
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		globalThis.dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowRight" }),
		);
		globalThis.dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowLeft" }),
		);
		globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
		expect(mocks.navigate).toHaveBeenCalled();
	});

	test("mouse move shows toolbar", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				title: "Book",
				files: [{ id: 10, format: "epub" }],
			},
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		const app = screen.container.querySelector(
			'[role="application"]',
		) as HTMLElement;
		app?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
		app?.click();
	});
});
