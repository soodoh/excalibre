import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
		useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
		useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
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
	redirect: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
	useMutation: (...args: unknown[]) => mocks.useMutation(...args),
	useQueryClient: () => mocks.useQueryClient(),
}));

vi.mock("src/server/libraries", () => ({
	deleteLibraryFn: vi.fn(),
	getLibrariesFn: vi.fn(),
}));

vi.mock("src/server/middleware", () => ({
	getAuthSessionFn: vi.fn(),
}));

vi.mock("src/components/settings/library-form", () => ({
	LibraryForm: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import "./libraries";

type ComponentType = () => React.JSX.Element;

describe("LibrariesSettingsPage", () => {
	test("shows loading state", async () => {
		mocks.useQuery.mockReturnValue({ data: undefined, isLoading: true });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByText("Loading libraries..."))
			.toBeVisible();
	});

	test("shows empty state message", async () => {
		mocks.useQuery.mockReturnValue({ data: [], isLoading: false });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByText("No libraries yet. Add one to get started."))
			.toBeVisible();
	});

	test("renders table with library rows", async () => {
		mocks.useQuery.mockReturnValue({
			data: [
				{
					id: 1,
					name: "Fiction",
					type: "ebook",
					scanPaths: ["/books"],
					scanInterval: 60,
					lastScannedAt: null,
				},
			],
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("cell", { name: "Fiction", exact: true }))
			.toBeVisible();
		await expect.element(screen.getByText("Never")).toBeVisible();
	});

	test("renders page title and Add button", async () => {
		mocks.useQuery.mockReturnValue({ data: [], isLoading: false });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "Libraries" }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("button", { name: /Add Library/i }))
			.toBeVisible();
	});
});
