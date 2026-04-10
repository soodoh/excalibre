import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		params: { seriesId: "1" },
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
}));

vi.mock("src/server/authors", () => ({
	getSeriesDetailFn: vi.fn(),
}));

import "./series.$seriesId";

type ComponentType = () => React.JSX.Element;

describe("SeriesDetailPage", () => {
	test("shows not found when series is null", async () => {
		mocks.useQuery.mockReturnValue({ data: null, isLoading: false });
		const SeriesPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SeriesPage />);
		await expect.element(screen.getByText("Series not found")).toBeVisible();
	});

	test("renders series name and book count", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				id: 1,
				name: "Epic Series",
				books: [
					{ id: 1, title: "Book One", coverPath: null, seriesIndex: 1 },
					{ id: 2, title: "Book Two", coverPath: null, seriesIndex: 2 },
				],
			},
			isLoading: false,
		});
		const SeriesPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SeriesPage />);
		await expect
			.element(screen.getByRole("heading", { name: "Epic Series" }))
			.toBeVisible();
		await expect.element(screen.getByText("2 books")).toBeVisible();
	});

	test("renders books in series with index", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				id: 1,
				name: "Epic Series",
				books: [
					{ id: 1, title: "First Volume", coverPath: null, seriesIndex: 1 },
				],
			},
			isLoading: false,
		});
		const SeriesPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SeriesPage />);
		await expect.element(screen.getByText("First Volume")).toBeVisible();
		await expect.element(screen.getByText("#1")).toBeVisible();
	});

	test("renders empty state when no books", async () => {
		mocks.useQuery.mockReturnValue({
			data: { id: 1, name: "Empty", books: [] },
			isLoading: false,
		});
		const SeriesPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SeriesPage />);
		await expect.element(screen.getByText("No books found")).toBeVisible();
	});

	test("shows loading skeleton", async () => {
		mocks.useQuery.mockReturnValue({ data: undefined, isLoading: true });
		const SeriesPage = mocks.getComponent() as ComponentType;
		await render(<SeriesPage />);
	});

	test("renders singular book count", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				id: 1,
				name: "One Book",
				books: [{ id: 1, title: "Only", coverPath: null, seriesIndex: 1 }],
			},
			isLoading: false,
		});
		const SeriesPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SeriesPage />);
		await expect.element(screen.getByText("1 book")).toBeVisible();
	});

	test("renders book with null seriesIndex shows ?", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				id: 1,
				name: "Series",
				books: [
					{ id: 1, title: "Unnumbered", coverPath: null, seriesIndex: null },
				],
			},
			isLoading: false,
		});
		const SeriesPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SeriesPage />);
		await expect.element(screen.getByText("?")).toBeVisible();
	});

	test("renders cover image when coverPath provided", async () => {
		mocks.useQuery.mockReturnValue({
			data: {
				id: 1,
				name: "Series",
				books: [{ id: 1, title: "Cover", coverPath: "/c.jpg", seriesIndex: 1 }],
			},
			isLoading: false,
		});
		const SeriesPage = mocks.getComponent() as ComponentType;
		await render(<SeriesPage />);
	});

	test("back button calls router.history.back", async () => {
		mocks.useQuery.mockReturnValue({
			data: { id: 1, name: "S", books: [] },
			isLoading: false,
		});
		const SeriesPage = mocks.getComponent() as ComponentType;
		const screen = await render(<SeriesPage />);
		await screen.getByRole("button", { name: /Back/i }).click();
		expect(mocks.router.history.back).toHaveBeenCalled();
	});
});
