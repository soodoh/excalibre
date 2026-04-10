import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		params: { authorId: "1" },
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
		useRouter: () => mocks.router,
	};
});

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("src/server/authors", () => ({
	getAuthorDetailFn: vi.fn(),
}));

vi.mock("src/components/library/book-grid", () => ({
	default: ({ books }: { books: Array<{ id: number; title: string }> }) => (
		<div data-testid="book-grid">books:{books.length}</div>
	),
}));

import "./authors.$authorId";

type ComponentType = () => React.JSX.Element;

describe("AuthorDetailPage", () => {
	test("shows not found when author is null", async () => {
		mocks.useQuery.mockReturnValue({ data: null, isLoading: false });
		const AuthorPage = mocks.getComponent() as ComponentType;
		const screen = await render(<AuthorPage />);
		await expect.element(screen.getByText("Author not found")).toBeVisible();
	});

	test("renders author name and book count", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				id: 1,
				name: "Jane Author",
				bio: "A great writer",
				books: [
					{
						id: 1,
						title: "Book One",
						coverPath: null,
						seriesIndex: null,
						createdAt: new Date(),
					},
					{
						id: 2,
						title: "Book Two",
						coverPath: null,
						seriesIndex: null,
						createdAt: new Date(),
					},
				],
			},
			isLoading: false,
		});
		const AuthorPage = mocks.getComponent() as ComponentType;
		const screen = await render(<AuthorPage />);
		await expect
			.element(screen.getByRole("heading", { name: "Jane Author" }))
			.toBeVisible();
		await expect.element(screen.getByText("2 books")).toBeVisible();
	});

	test("renders author bio", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				id: 1,
				name: "Jane",
				bio: "A great writer",
				books: [],
			},
			isLoading: false,
		});
		const AuthorPage = mocks.getComponent() as ComponentType;
		const screen = await render(<AuthorPage />);
		await expect.element(screen.getByText("A great writer")).toBeVisible();
	});

	test("renders BookGrid for author books", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				id: 1,
				name: "Jane",
				bio: null,
				books: [
					{
						id: 1,
						title: "Book",
						coverPath: null,
						seriesIndex: null,
						createdAt: new Date(),
					},
				],
			},
			isLoading: false,
		});
		const AuthorPage = mocks.getComponent() as ComponentType;
		const screen = await render(<AuthorPage />);
		await expect.element(screen.getByTestId("book-grid")).toBeVisible();
	});

	test("shows loading skeleton while loading", async () => {
		mocks.useQuery.mockReturnValue({ data: undefined, isLoading: true });
		const AuthorPage = mocks.getComponent() as ComponentType;
		await render(<AuthorPage />);
	});

	test("singular book count", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				id: 1,
				name: "Jane",
				bio: null,
				books: [
					{
						id: 1,
						title: "Book",
						coverPath: null,
						seriesIndex: null,
						createdAt: new Date(),
					},
				],
			},
			isLoading: false,
		});
		const AuthorPage = mocks.getComponent() as ComponentType;
		const screen = await render(<AuthorPage />);
		await expect.element(screen.getByText("1 book")).toBeVisible();
	});

	test("back button navigates back", async () => {
		mocks.useQuery.mockReturnValue({
			data: { id: 1, name: "Jane", bio: null, books: [] },
			isLoading: false,
		});
		const AuthorPage = mocks.getComponent() as ComponentType;
		const screen = await render(<AuthorPage />);
		await screen.getByRole("button", { name: /Back/i }).click();
		expect(mocks.router.history.back).toHaveBeenCalled();
	});
});
