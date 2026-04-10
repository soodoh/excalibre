import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("src/hooks/use-mobile", () => ({
	useIsMobile: useIsMobileMock,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		...rest
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => <a {...rest}>{children}</a>,
	useRouterState: () => ({ location: { pathname: "/" } }),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock("src/lib/auth-client", () => ({
	useSession: vi.fn(() => ({
		data: {
			user: {
				id: "1",
				name: "Test",
				email: "test@test.com",
				role: "admin",
			},
		},
		isPending: false,
	})),
	signOut: vi.fn(),
}));

vi.mock("src/server/libraries", () => ({
	getLibrariesFn: vi.fn(),
}));

vi.mock("src/server/shelves", () => ({
	getShelvesFn: vi.fn(),
}));

vi.mock("src/server/collections", () => ({
	getCollectionsFn: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (fn: unknown) => fn,
		inputValidator: () => ({ handler: (fn: unknown) => fn }),
	}),
}));

vi.mock("src/components/organization/collection-form", () => ({
	CollectionForm: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock("src/components/organization/shelf-form", () => ({
	ShelfForm: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

import AppLayout from "./app-layout";

describe("AppLayout", () => {
	test("renders children content", async () => {
		const screen = await render(
			<AppLayout>
				<div>Page Content</div>
			</AppLayout>,
		);
		await expect.element(screen.getByText("Page Content")).toBeVisible();
	});

	test("renders the sidebar", async () => {
		const screen = await render(
			<AppLayout>
				<div>Content</div>
			</AppLayout>,
		);
		await expect.element(screen.getByText("Excalibre")).toBeVisible();
	});

	test("renders the header with search button", async () => {
		const screen = await render(
			<AppLayout>
				<div>Content</div>
			</AppLayout>,
		);
		await expect
			.element(screen.getByRole("button", { name: "Search" }))
			.toBeVisible();
	});

	test("renders main content area", async () => {
		const screen = await render(
			<AppLayout>
				<div>Main Area</div>
			</AppLayout>,
		);
		const main = screen.container.querySelector("main");
		expect(main).toBeTruthy();
		await expect.element(screen.getByText("Main Area")).toBeVisible();
	});
});
