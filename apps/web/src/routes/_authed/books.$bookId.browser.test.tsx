import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		params: { bookId: "1" },
		router: { history: { back: vi.fn() } },
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
		Link: ({
			children,
			to,
			...rest
		}: {
			children: React.ReactNode;
			to?: string;
			[k: string]: unknown;
		}) => (
			<a href={to} {...rest}>
				{children}
			</a>
		),
		useRouter: () => mocks.router,
	};
});

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("src/server/books", () => ({
	getBookDetailFn: vi.fn(),
}));

vi.mock("src/components/library/convert-dialog", () => ({
	ConvertDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock("src/components/organization/add-to-shelf", () => ({
	AddToShelf: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

import "./books.$bookId";

type ComponentType = () => React.JSX.Element;

const sampleBook = {
	id: 1,
	title: "Test Book",
	description: "A fine book indeed",
	coverPath: null,
	publisher: "Test Publisher",
	publishDate: "2024-01-01",
	language: "en",
	pageCount: 300,
	isbn10: null,
	isbn13: "9781234567890",
	rating: 4.5,
	seriesId: null,
	seriesIndex: null,
	libraryId: 1,
	authors: [{ id: 1, name: "John Author", role: "author" as const }],
	files: [{ id: 10, format: "epub", fileSize: 1024000, source: "library" }],
	series: null,
	tags: [{ id: 1, name: "Fiction" }],
};

describe("BookDetailPage", () => {
	test("shows loading skeleton", async () => {
		mocks.useQuery.mockReturnValue({ data: undefined, isLoading: true });
		const BookDetailPage = mocks.getComponent() as ComponentType;
		const screen = await render(<BookDetailPage />);
		// Skeleton renders — at least the container exists
		expect(screen.container.querySelector(".flex")).toBeTruthy();
	});

	test("shows not found when book is null", async () => {
		mocks.useQuery.mockReturnValue({ data: null, isLoading: false });
		const BookDetailPage = mocks.getComponent() as ComponentType;
		const screen = await render(<BookDetailPage />);
		await expect.element(screen.getByText("Book not found")).toBeVisible();
	});

	test("renders book title and author", async () => {
		mocks.useQuery.mockReturnValue({ data: sampleBook, isLoading: false });
		const BookDetailPage = mocks.getComponent() as ComponentType;
		const screen = await render(<BookDetailPage />);
		await expect
			.element(screen.getByRole("heading", { name: "Test Book" }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("link", { name: "John Author" }))
			.toBeVisible();
	});

	test("renders description", async () => {
		mocks.useQuery.mockReturnValue({ data: sampleBook, isLoading: false });
		const BookDetailPage = mocks.getComponent() as ComponentType;
		const screen = await render(<BookDetailPage />);
		await expect.element(screen.getByText("A fine book indeed")).toBeVisible();
	});

	test("renders Read button when files exist", async () => {
		mocks.useQuery.mockReturnValue({ data: sampleBook, isLoading: false });
		const BookDetailPage = mocks.getComponent() as ComponentType;
		const screen = await render(<BookDetailPage />);
		await expect
			.element(screen.getByRole("button", { name: /Read/i }).first())
			.toBeVisible();
	});

	test("renders metadata rows", async () => {
		mocks.useQuery.mockReturnValue({ data: sampleBook, isLoading: false });
		const BookDetailPage = mocks.getComponent() as ComponentType;
		const screen = await render(<BookDetailPage />);
		await expect
			.element(screen.getByText("Publisher", { exact: true }))
			.toBeVisible();
		await expect.element(screen.getByText("Test Publisher")).toBeVisible();
		await expect.element(screen.getByText("ISBN-13")).toBeVisible();
	});

	test("renders tags", async () => {
		mocks.useQuery.mockReturnValue({ data: sampleBook, isLoading: false });
		const BookDetailPage = mocks.getComponent() as ComponentType;
		const screen = await render(<BookDetailPage />);
		await expect.element(screen.getByText("Fiction")).toBeVisible();
	});

	test("renders Files section with format", async () => {
		mocks.useQuery.mockReturnValue({ data: sampleBook, isLoading: false });
		const BookDetailPage = mocks.getComponent() as ComponentType;
		const screen = await render(<BookDetailPage />);
		await expect
			.element(screen.getByRole("heading", { name: "Files" }))
			.toBeVisible();
		await expect.element(screen.getByText("EPUB")).toBeVisible();
	});

	test("renders 'No readable files' when no files", async () => {
		mocks.useQuery.mockReturnValue({
			data: { ...sampleBook, files: [] },
			isLoading: false,
		});
		const BookDetailPage = mocks.getComponent() as ComponentType;
		const screen = await render(<BookDetailPage />);
		await expect
			.element(screen.getByRole("button", { name: "No readable files" }))
			.toBeVisible();
	});
});
