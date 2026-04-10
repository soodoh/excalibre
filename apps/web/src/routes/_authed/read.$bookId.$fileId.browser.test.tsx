import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		navigate: vi.fn(),
		params: { bookId: "1", fileId: "10" },
		setComponent: (c: unknown) => {
			captured = c;
		},
		getComponent: () => captured,
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
	EbookReader: () => <div data-testid="ebook-reader">Ebook Reader</div>,
}));

vi.mock("src/components/reader/pdf-reader", () => ({
	PdfReader: () => <div data-testid="pdf-reader">PDF Reader</div>,
}));

vi.mock("src/components/reader/reader-toolbar", () => ({
	ReaderToolbar: ({ bookTitle }: { bookTitle: string }) => (
		<div data-testid="reader-toolbar">{bookTitle}</div>
	),
}));

vi.mock("src/components/reader/reader-settings", () => ({
	ReaderSettingsPanel: () => null,
}));

vi.mock("src/components/reader/reader-progress-bar", () => ({
	ReaderProgressBar: () => <div data-testid="progress-bar" />,
}));

vi.mock("src/components/reader/toc-drawer", () => ({
	TocDrawer: () => null,
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
});
