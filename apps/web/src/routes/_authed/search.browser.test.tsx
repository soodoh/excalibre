import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		navigate: vi.fn(),
		searchValue: { q: "" } as { q: string },
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
	const Route: {
		useSearch: () => { q: string };
		fullPath: string;
	} = {
		useSearch: () => mocks.searchValue,
		fullPath: "/search",
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
		useNavigate: () => mocks.navigate,
	};
});

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("src/server/search", () => ({
	searchFn: vi.fn(),
}));

vi.mock("src/components/library/book-grid", () => ({
	default: ({ books }: { books: Array<{ id: number; title: string }> }) => (
		<div data-testid="book-grid">books:{books.length}</div>
	),
}));

import "./search";

type ComponentType = () => React.JSX.Element;

describe("SearchPage", () => {
	test("renders search input", async () => {
		mocks.searchValue = { q: "" };
		mocks.useQuery.mockReturnValue({ data: undefined, isLoading: false });
		const SearchPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SearchPage />);
		await expect
			.element(
				screen.getByPlaceholder("Search for books, authors, or series..."),
			)
			.toBeVisible();
	});

	test("shows empty state prompt when no query", async () => {
		mocks.searchValue = { q: "" };
		mocks.useQuery.mockReturnValue({ data: undefined, isLoading: false });
		const SearchPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SearchPage />);
		await expect
			.element(screen.getByText("Search for books, authors, or series"))
			.toBeVisible();
	});

	test("shows no results message when query has no matches", async () => {
		mocks.searchValue = { q: "xyz" };
		mocks.useQuery.mockReturnValue({
			data: { books: [], authors: [], series: [] },
			isLoading: false,
		});
		const SearchPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SearchPage />);
		await expect
			.element(screen.getByText(/No results found for/i))
			.toBeVisible();
	});

	test("shows books section when books returned", async () => {
		mocks.searchValue = { q: "book" };
		mocks.useQuery.mockReturnValue({
			data: {
				books: [{ id: 1, title: "Test Book", coverPath: null }],
				authors: [],
				series: [],
			},
			isLoading: false,
		});
		const SearchPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SearchPage />);
		await expect
			.element(screen.getByRole("heading", { name: /Books/ }))
			.toBeVisible();
		await expect.element(screen.getByTestId("book-grid")).toBeVisible();
	});

	test("shows authors section when authors returned", async () => {
		mocks.searchValue = { q: "author" };
		mocks.useQuery.mockReturnValue({
			data: {
				books: [],
				authors: [{ id: 1, name: "Jane Author" }],
				series: [],
			},
			isLoading: false,
		});
		const SearchPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SearchPage />);
		await expect
			.element(screen.getByRole("heading", { name: /Authors/ }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("link", { name: "Jane Author" }))
			.toBeVisible();
	});

	test("shows series section when series returned", async () => {
		mocks.searchValue = { q: "series" };
		mocks.useQuery.mockReturnValue({
			data: {
				books: [],
				authors: [],
				series: [{ id: 1, name: "Epic Series" }],
			},
			isLoading: false,
		});
		const SearchPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SearchPage />);
		await expect
			.element(screen.getByRole("heading", { name: /Series/ }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("link", { name: "Epic Series" }))
			.toBeVisible();
	});
});
