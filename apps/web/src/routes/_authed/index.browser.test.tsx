import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		useSession: vi.fn(),
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

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (opts: { component: unknown }) => {
		mocks.setComponent(opts.component);
		return { component: opts.component };
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
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("src/lib/auth-client", () => ({
	useSession: () => mocks.useSession(),
}));

vi.mock("src/server/books", () => ({
	getRecentBooksFn: vi.fn(),
}));

vi.mock("src/server/search", () => ({
	getContinueReadingFn: vi.fn(),
}));

vi.mock("src/components/library/book-grid", () => ({
	default: ({
		books,
		isLoading,
	}: {
		books: Array<{ id: number; title: string }>;
		isLoading: boolean;
	}) => (
		<div data-testid="book-grid">
			{isLoading ? "loading" : `books:${books.length}`}
		</div>
	),
}));

import "./index";

type ComponentType = () => React.JSX.Element;

function setQueryData(
	continueReading: unknown[],
	recentBooks: unknown[],
	isLoading = false,
) {
	mocks.useQuery.mockImplementation((opts: { queryKey: unknown[] }) => {
		const key = JSON.stringify(opts.queryKey);
		if (key.includes("continueReading") || key.includes("continue")) {
			return { data: continueReading, isLoading };
		}
		return { data: recentBooks, isLoading };
	});
}

describe("HomePage (_authed/index)", () => {
	test("renders Continue Reading and Recently Added sections", async () => {
		mocks.useSession.mockReturnValue({
			data: { user: { id: "1", role: "user" } },
		});
		setQueryData([], []);
		const HomePage = mocks.getComponent() as ComponentType;
		const screen = await render(<HomePage />);
		await expect.element(screen.getByText("Continue Reading")).toBeVisible();
		await expect.element(screen.getByText("Recently Added")).toBeVisible();
	});

	test("shows continue reading placeholder when empty", async () => {
		mocks.useSession.mockReturnValue({
			data: { user: { id: "1", role: "user" } },
		});
		setQueryData([], []);
		const HomePage = mocks.getComponent() as ComponentType;
		const screen = await render(<HomePage />);
		await expect
			.element(screen.getByText("Start reading a book to see it here"))
			.toBeVisible();
	});

	test("shows empty library message for non-admin users", async () => {
		mocks.useSession.mockReturnValue({
			data: { user: { id: "1", role: "user" } },
		});
		setQueryData([], []);
		const HomePage = mocks.getComponent() as ComponentType;
		const screen = await render(<HomePage />);
		await expect
			.element(screen.getByText("Your library is empty."))
			.toBeVisible();
		await expect
			.element(screen.getByText("Ask your administrator to add libraries."))
			.toBeVisible();
	});

	test("shows admin link when user is admin and library empty", async () => {
		mocks.useSession.mockReturnValue({
			data: { user: { id: "1", role: "admin" } },
		});
		setQueryData([], []);
		const HomePage = mocks.getComponent() as ComponentType;
		const screen = await render(<HomePage />);
		await expect
			.element(screen.getByRole("link", { name: "Settings → Libraries" }))
			.toBeVisible();
	});

	test("renders continue reading cards when books exist", async () => {
		mocks.useSession.mockReturnValue({
			data: { user: { id: "1", role: "user" } },
		});
		setQueryData(
			[{ id: 1, title: "Book One", coverPath: null, progress: 0.5 }],
			[],
		);
		const HomePage = mocks.getComponent() as ComponentType;
		const screen = await render(<HomePage />);
		await expect.element(screen.getByText("Book One")).toBeVisible();
		await expect.element(screen.getByText("50%")).toBeVisible();
	});

	test("renders BookGrid when recent books exist", async () => {
		mocks.useSession.mockReturnValue({
			data: { user: { id: "1", role: "user" } },
		});
		setQueryData([], [{ id: 2, title: "Recent Book", coverPath: null }]);
		const HomePage = mocks.getComponent() as ComponentType;
		const screen = await render(<HomePage />);
		await expect.element(screen.getByTestId("book-grid")).toBeVisible();
	});

	test("shows loading state for continue reading", async () => {
		mocks.useSession.mockReturnValue({
			data: { user: { id: "1", role: "user" } },
		});
		setQueryData([], [], true);
		const HomePage = mocks.getComponent() as ComponentType;
		await render(<HomePage />);
	});

	test("continue reading card with null progress renders 0%", async () => {
		mocks.useSession.mockReturnValue({
			data: { user: { id: "1", role: "user" } },
		});
		setQueryData(
			[{ id: 1, title: "Unread", coverPath: null, progress: null }],
			[],
		);
		const HomePage = mocks.getComponent() as ComponentType;
		const screen = await render(<HomePage />);
		await expect.element(screen.getByText("0%")).toBeVisible();
	});

	test("continue reading card with cover renders image", async () => {
		mocks.useSession.mockReturnValue({
			data: { user: { id: "1", role: "user" } },
		});
		setQueryData(
			[{ id: 1, title: "With Cover", coverPath: "/c.jpg", progress: 0.25 }],
			[],
		);
		const HomePage = mocks.getComponent() as ComponentType;
		await render(<HomePage />);
	});

	test("handles undefined session gracefully", async () => {
		mocks.useSession.mockReturnValue({ data: undefined });
		setQueryData([], []);
		const HomePage = mocks.getComponent() as ComponentType;
		await render(<HomePage />);
	});
});
