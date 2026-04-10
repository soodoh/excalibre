import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
		useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
		params: { listId: "1" },
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
	useMutation: (...args: unknown[]) => mocks.useMutation(...args),
	useQueryClient: () => mocks.useQueryClient(),
}));

vi.mock("src/server/reading-lists", () => ({
	deleteReadingListFn: vi.fn(),
	getReadingListBooksFn: vi.fn(),
	getReadingListsFn: vi.fn(),
	removeBookFromReadingListFn: vi.fn(),
	reorderReadingListFn: vi.fn(),
}));

vi.mock("src/components/organization/reading-list-form", () => ({
	ReadingListForm: ({ trigger }: { trigger: React.ReactNode }) => (
		<>{trigger}</>
	),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import "./reading-lists.$listId";

type ComponentType = () => React.JSX.Element;

function setQueries(lists: unknown, books: unknown, isBooksLoading = false) {
	mocks.useQuery.mockImplementation((opts: { queryKey: unknown[] }) => {
		const key = JSON.stringify(opts.queryKey);
		if (key.includes("books")) {
			return { data: books, isLoading: isBooksLoading };
		}
		return { data: lists, isLoading: false };
	});
}

describe("ReadingListBrowsePage", () => {
	test("shows not found when list is missing", async () => {
		setQueries([], []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByText("Reading list not found"))
			.toBeVisible();
	});

	test("renders reading list name and book count", async () => {
		setQueries(
			[{ id: 1, name: "My TBR" }],
			[
				{ id: 10, title: "Book A", coverPath: null, sortOrder: 1 },
				{ id: 20, title: "Book B", coverPath: null, sortOrder: 2 },
			],
		);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "My TBR" }))
			.toBeVisible();
		await expect.element(screen.getByText("2 books")).toBeVisible();
	});

	test("renders empty message when no books", async () => {
		setQueries([{ id: 1, name: "Empty" }], []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByText("No books in this reading list"))
			.toBeVisible();
	});

	test("renders move up/down and remove controls", async () => {
		setQueries(
			[{ id: 1, name: "My TBR" }],
			[{ id: 10, title: "Book", coverPath: null, sortOrder: 1 }],
		);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("button", { name: "Move up" }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("button", { name: "Move down" }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("button", { name: "Remove from reading list" }))
			.toBeVisible();
	});
});
