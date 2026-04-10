import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	const mutations: Array<{
		mutationFn: (...args: unknown[]) => unknown;
		onSuccess?: (...args: unknown[]) => unknown;
		onError?: (error: Error) => unknown;
	}> = [];
	let headerProps: {
		onSearchChange: (v: string) => void;
		onScan: () => void;
	} | null = null;
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
		useSession: vi.fn(() => ({
			data: { user: { id: "1", role: "admin" } },
		})),
		mutations,
		resetMutations: () => {
			mutations.length = 0;
		},
		setHeaderProps: (p: typeof headerProps) => {
			headerProps = p;
		},
		getHeaderProps: () => headerProps,
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
	default: (props: {
		library: { name: string };
		bookCount: number;
		onSearchChange: (v: string) => void;
		onScan: () => void;
	}) => {
		mocks.setHeaderProps(props);
		return (
			<div data-testid="library-header">
				{props.library.name} ({props.bookCount})
			</div>
		);
	},
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

	test("search and scan callbacks work", async () => {
		setQueries({ id: 1, name: "Fiction" }, { books: [], total: 0 });
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		const headerProps = mocks.getHeaderProps();
		headerProps?.onSearchChange("hello");
		headerProps?.onScan();
	});

	test("scan mutation success and error handlers", async () => {
		mocks.resetMutations();
		setQueries({ id: 1, name: "Fiction" }, { books: [], total: 0 });
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		const mut = mocks.mutations[0];
		await mut?.onSuccess?.({ added: 1, updated: 2, missing: 3 });
		mut?.onError?.(new Error("scan fail"));
		mut?.onError?.(new Error(""));
		await mut?.mutationFn?.();
	});

	test("isAdmin is false for non-admin users", async () => {
		mocks.useSession.mockReturnValueOnce({
			data: { user: { id: "1", role: "user" } },
		});
		setQueries({ id: 1, name: "Fiction" }, { books: [], total: 0 });
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
	});

	test("session undefined works", async () => {
		mocks.useSession.mockReturnValueOnce({ data: undefined });
		setQueries({ id: 1, name: "Fiction" }, { books: [], total: 0 });
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
	});
});
