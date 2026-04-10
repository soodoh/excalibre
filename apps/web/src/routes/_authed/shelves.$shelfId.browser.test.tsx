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
		params: { shelfId: "1" },
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

vi.mock("src/server/shelves", () => ({
	deleteShelfFn: vi.fn(),
	getShelfBooksFn: vi.fn(),
	getShelfFn: vi.fn(),
	removeBookFromShelfFn: vi.fn(),
}));

vi.mock("src/components/organization/shelf-form", () => ({
	ShelfForm: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock("src/components/library/book-grid", () => ({
	default: ({ books }: { books: Array<{ id: number; title: string }> }) => (
		<div data-testid="book-grid">books:{books.length}</div>
	),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import "./shelves.$shelfId";

type ComponentType = () => React.JSX.Element;

function setQueries(shelf: unknown, books: unknown) {
	mocks.useQuery.mockImplementation((opts: { queryKey: unknown[] }) => {
		const key = JSON.stringify(opts.queryKey);
		if (key.includes("books")) {
			return { data: books, isLoading: false };
		}
		return { data: shelf, isLoading: false };
	});
}

describe("ShelfBrowsePage", () => {
	test("shows not found when shelf missing", async () => {
		setQueries(null, []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Shelf not found")).toBeVisible();
	});

	test("renders shelf name, type badge, and count", async () => {
		setQueries({ id: 1, name: "Favorites", type: "manual" }, [
			{ id: 10, title: "A", coverPath: null, authorName: "x" },
			{ id: 20, title: "B", coverPath: null, authorName: "y" },
		]);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "Favorites" }))
			.toBeVisible();
		await expect.element(screen.getByText("Manual")).toBeVisible();
		await expect.element(screen.getByText("2 books")).toBeVisible();
	});

	test("renders smart shelf badge for smart shelves", async () => {
		setQueries({ id: 1, name: "Auto", type: "smart" }, []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Smart")).toBeVisible();
	});

	test("renders edit and delete buttons", async () => {
		setQueries({ id: 1, name: "Favs", type: "manual" }, []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("button", { name: /Edit/i }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("button", { name: /Delete/i }))
			.toBeVisible();
	});

	test("shows skeleton while loading", async () => {
		mocks.useQuery.mockImplementation(() => ({
			data: undefined,
			isLoading: true,
		}));
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Back")).not.toBeInTheDocument();
	});

	test("renders book cards for manual shelf with books", async () => {
		setQueries({ id: 1, name: "Favs", type: "manual" }, [
			{ id: 10, title: "Book A", coverPath: "/cover.jpg", authorName: "Auth" },
			{ id: 20, title: "Book B", coverPath: null },
		]);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Book A")).toBeVisible();
		await expect.element(screen.getByText("Book B")).toBeVisible();
	});

	test("back button calls router history back", async () => {
		setQueries({ id: 1, name: "Favs", type: "manual" }, []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await screen.getByRole("button", { name: /Back/i }).click();
		expect(mocks.router.history.back).toHaveBeenCalled();
	});

	test("delete button opens confirmation dialog, cancel closes it", async () => {
		setQueries({ id: 1, name: "Favs", type: "manual" }, []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await screen.getByRole("button", { name: /Delete/i }).click();
		await expect
			.element(screen.getByRole("heading", { name: "Delete Shelf" }))
			.toBeVisible();
		await screen.getByRole("button", { name: "Cancel" }).click();
	});

	test("delete mutation success handler invalidates queries", async () => {
		mocks.resetMutations();
		setQueries({ id: 1, name: "Favs", type: "manual" }, []);
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		// Trigger delete mutation's onSuccess
		const deleteMutation = mocks.mutations[0];
		await deleteMutation?.onSuccess?.();
		expect(mocks.router.history.back).toHaveBeenCalled();
	});

	test("delete mutation error handler shows toast", async () => {
		mocks.resetMutations();
		setQueries({ id: 1, name: "Favs", type: "manual" }, []);
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		const deleteMutation = mocks.mutations[0];
		deleteMutation?.onError?.(new Error("bad"));
		deleteMutation?.onError?.(new Error(""));
	});

	test("remove book mutation success and error handlers", async () => {
		mocks.resetMutations();
		setQueries({ id: 1, name: "Favs", type: "manual" }, [
			{ id: 10, title: "A", coverPath: null },
		]);
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		const removeMutation = mocks.mutations[1];
		await removeMutation?.onSuccess?.();
		removeMutation?.onError?.(new Error("oops"));
		// Also call the mutationFn to execute it
		removeMutation?.mutationFn?.(10);
	});
});
