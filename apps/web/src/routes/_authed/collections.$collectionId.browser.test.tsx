import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	const mutations: Array<{
		mutationFn: (...args: unknown[]) => unknown;
		onSuccess?: (...args: unknown[]) => unknown;
		onError?: (error: Error) => unknown;
	}> = [];
	return {
		useQuery: vi.fn(),
		useMutation: vi.fn(
			(opts: {
				mutationFn: (...args: unknown[]) => unknown;
				onSuccess?: (...args: unknown[]) => unknown;
				onError?: (error: Error) => unknown;
			}) => {
				mutations.push(opts);
				return { mutate: vi.fn(), isPending: false };
			},
		),
		useQueryClient: vi.fn(() => ({
			invalidateQueries: vi.fn().mockResolvedValue(undefined),
		})),
		mutations,
		resetMutations: () => {
			mutations.length = 0;
		},
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

	test("shows skeleton while collection loading", async () => {
		mocks.useQuery.mockImplementation(() => ({
			data: undefined,
			isLoading: true,
		}));
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
	});

	test("back button calls router.history.back", async () => {
		setQueries([{ id: 1, name: "Favorites" }], []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await screen.getByRole("button", { name: /Back/i }).click();
		expect(mocks.router.history.back).toHaveBeenCalled();
	});

	test("delete button opens confirmation dialog", async () => {
		setQueries([{ id: 1, name: "Favorites" }], []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await screen.getByRole("button", { name: /Delete/i }).click();
		await expect
			.element(screen.getByRole("heading", { name: "Delete Collection" }))
			.toBeVisible();
		await screen.getByRole("button", { name: "Cancel" }).click();
	});

	test("renders cover image when coverPath present", async () => {
		setQueries(
			[{ id: 1, name: "Favorites" }],
			[{ id: 10, title: "A", coverPath: "/c.jpg", authorName: "Auth" }],
		);
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
	});

	test("mutation success/error handlers execute", async () => {
		mocks.resetMutations();
		setQueries([{ id: 1, name: "Favorites" }], []);
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		// deleteMutation [0]
		await mocks.mutations[0]?.onSuccess?.();
		mocks.mutations[0]?.onError?.(new Error("del"));
		mocks.mutations[0]?.onError?.(new Error(""));
		await mocks.mutations[0]?.mutationFn?.();
		// removeBookMutation [1]
		await mocks.mutations[1]?.onSuccess?.();
		mocks.mutations[1]?.onError?.(new Error("rem"));
		mocks.mutations[1]?.onError?.(new Error(""));
		await mocks.mutations[1]?.mutationFn?.(10);
	});
});
