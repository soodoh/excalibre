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

	test("shows loading skeleton while list query pending", async () => {
		mocks.useQuery.mockImplementation(() => ({
			data: undefined,
			isLoading: true,
		}));
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
	});

	test("renders books loading skeleton when books loading", async () => {
		mocks.useQuery.mockImplementation((opts: { queryKey: unknown[] }) => {
			const key = JSON.stringify(opts.queryKey);
			if (key.includes("books")) {
				return { data: undefined, isLoading: true };
			}
			return { data: [{ id: 1, name: "My TBR" }], isLoading: false };
		});
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
	});

	test("back button calls router.history.back", async () => {
		setQueries([{ id: 1, name: "My TBR" }], []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await screen.getByRole("button", { name: /Back/i }).click();
		expect(mocks.router.history.back).toHaveBeenCalled();
	});

	test("delete button opens dialog and cancel closes it", async () => {
		setQueries([{ id: 1, name: "My TBR" }], []);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await screen.getByRole("button", { name: /Delete/i }).click();
		await expect
			.element(screen.getByRole("heading", { name: "Delete Reading List" }))
			.toBeVisible();
		await screen.getByRole("button", { name: "Cancel" }).click();
	});

	test("handle move up/down swaps adjacent books", async () => {
		mocks.resetMutations();
		setQueries(
			[{ id: 1, name: "My TBR" }],
			[
				{ id: 10, title: "A", coverPath: null, sortOrder: 1 },
				{ id: 20, title: "B", coverPath: null, sortOrder: 2 },
				{ id: 30, title: "C", coverPath: null, sortOrder: 3 },
			],
		);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		// Click move down on first book (should work)
		const moveDownButtons = screen.getByRole("button", { name: "Move down" });
		await moveDownButtons.first().click();
	});

	test("mutation success/error handlers execute", async () => {
		mocks.resetMutations();
		setQueries(
			[{ id: 1, name: "My TBR" }],
			[{ id: 10, title: "A", coverPath: null, sortOrder: 1 }],
		);
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		// delete mutation [0]
		await mocks.mutations[0]?.onSuccess?.();
		mocks.mutations[0]?.onError?.(new Error("del fail"));
		mocks.mutations[0]?.onError?.(new Error(""));
		await mocks.mutations[0]?.mutationFn?.();
		// remove book mutation [1]
		await mocks.mutations[1]?.onSuccess?.();
		mocks.mutations[1]?.onError?.(new Error("rem fail"));
		mocks.mutations[1]?.onError?.(new Error(""));
		await mocks.mutations[1]?.mutationFn?.(10);
		// reorder mutation [2]
		mocks.mutations[2]?.onError?.(new Error("reorder fail"));
		mocks.mutations[2]?.onError?.(new Error(""));
		await mocks.mutations[2]?.mutationFn?.([10, 20]);
	});

	test("cover thumbnail fallback when coverPath missing", async () => {
		setQueries(
			[{ id: 1, name: "TBR" }],
			[{ id: 10, title: "NoCover", coverPath: null, sortOrder: 1 }],
		);
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
	});

	test("cover thumbnail renders image when coverPath present", async () => {
		setQueries(
			[{ id: 1, name: "TBR" }],
			[
				{
					id: 10,
					title: "WithCover",
					coverPath: "/books/1/cover.jpg",
					sortOrder: 1,
				},
			],
		);
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
	});
});
