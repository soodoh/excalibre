import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
		useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
		params: { collectionId: "1" },
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
	useMutation: (...args: unknown[]) => mocks.useMutation(...args),
	useQueryClient: () => mocks.useQueryClient(),
}));

vi.mock("src/server/collections", () => ({
	deleteCollectionFn: vi.fn(),
	getCollectionBooksFn: vi.fn(),
	getCollectionsFn: vi.fn(),
	removeBookFromCollectionFn: vi.fn(),
}));

vi.mock("src/components/organization/collection-form", () => ({
	CollectionForm: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock("src/components/library/book-grid", () => ({
	default: ({ books }: { books: Array<{ id: number; title: string }> }) => (
		<div data-testid="book-grid">books:{books.length}</div>
	),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import "./collections.$collectionId";

type ComponentType = () => React.JSX.Element;

function setQueries(collections: unknown, books: unknown) {
	mocks.useQuery.mockImplementation((opts: { queryKey: unknown[] }) => {
		const key = JSON.stringify(opts.queryKey);
		if (key.includes("books")) {
			return { data: books, isLoading: false };
		}
		return { data: collections, isLoading: false };
	});
}

describe("CollectionBrowsePage", () => {
	test("shows not found when collection is missing", async () => {
		setQueries([], []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByText("Collection not found"))
			.toBeVisible();
	});

	test("renders collection name and book count", async () => {
		setQueries(
			[{ id: 1, name: "Favorites" }],
			[
				{ id: 10, title: "Book A", coverPath: null, authorName: "Auth" },
				{ id: 20, title: "Book B", coverPath: null, authorName: "Auth2" },
			],
		);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "Favorites" }))
			.toBeVisible();
		await expect.element(screen.getByText("2 books")).toBeVisible();
	});

	test("renders edit and delete buttons", async () => {
		setQueries([{ id: 1, name: "Favorites" }], []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("button", { name: /Edit/i }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("button", { name: /Delete/i }))
			.toBeVisible();
	});

	test("renders book titles when books present", async () => {
		setQueries(
			[{ id: 1, name: "Favorites" }],
			[
				{
					id: 10,
					title: "Interesting Book",
					coverPath: null,
					authorName: "Auth",
				},
			],
		);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Interesting Book")).toBeVisible();
	});
});
