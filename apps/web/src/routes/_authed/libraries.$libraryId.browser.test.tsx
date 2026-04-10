import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
		useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
		useSession: vi.fn(() => ({
			data: { user: { id: "1", role: "admin" } },
		})),
		params: { libraryId: "1" },
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
	};
});

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
	useMutation: (...args: unknown[]) => mocks.useMutation(...args),
	useQueryClient: () => mocks.useQueryClient(),
}));

vi.mock("src/lib/auth-client", () => ({
	useSession: () => mocks.useSession(),
}));

vi.mock("src/server/books", () => ({
	getBooksByLibraryFn: vi.fn(),
}));

vi.mock("src/server/libraries", () => ({
	getLibraryFn: vi.fn(),
}));

vi.mock("src/server/scan-actions", () => ({
	triggerScanFn: vi.fn(),
}));

vi.mock("src/components/library/library-header", () => ({
	default: ({
		library,
		bookCount,
	}: {
		library: { name: string };
		bookCount: number;
	}) => (
		<div data-testid="library-header">
			{library.name} ({bookCount})
		</div>
	),
}));

vi.mock("src/components/library/book-grid", () => ({
	default: ({ books }: { books: Array<{ id: number; title: string }> }) => (
		<div data-testid="book-grid">books:{books.length}</div>
	),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import "./libraries.$libraryId";

type ComponentType = () => React.JSX.Element;

function setQueries(
	library: unknown,
	books: unknown,
	{
		isLibraryLoading = false,
		isBooksLoading = false,
	}: { isLibraryLoading?: boolean; isBooksLoading?: boolean } = {},
) {
	mocks.useQuery.mockImplementation((opts: { queryKey: unknown[] }) => {
		const key = JSON.stringify(opts.queryKey);
		if (key.includes("books")) {
			return { data: books, isLoading: isBooksLoading };
		}
		return { data: library, isLoading: isLibraryLoading };
	});
}

describe("LibraryBrowsePage", () => {
	test("shows loading state", async () => {
		setQueries(undefined, undefined, { isLibraryLoading: true });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Loading library...")).toBeVisible();
	});

	test("shows not found state", async () => {
		setQueries(null, undefined);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Library not found")).toBeVisible();
	});

	test("renders library header and book grid", async () => {
		setQueries(
			{ id: 1, name: "Fiction" },
			{ books: [{ id: 1, title: "A Book", coverPath: null }], total: 1 },
		);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByTestId("library-header")).toBeVisible();
		await expect.element(screen.getByTestId("book-grid")).toBeVisible();
	});
});
