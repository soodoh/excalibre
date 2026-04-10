import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => ({
	useSession: vi.fn(() => ({
		data: {
			user: {
				id: "1",
				name: "Admin",
				email: "admin@test.com",
				role: "admin",
			},
		},
		isPending: false,
	})),
	signOut: vi.fn(),
	useQuery: vi.fn(() => ({ data: [], isLoading: false })),
	useIsMobile: vi.fn(() => false),
}));

vi.mock("src/hooks/use-mobile", () => ({
	useIsMobile: mocks.useIsMobile,
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
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("src/lib/auth-client", () => ({
	useSession: () => mocks.useSession(),
	signOut: (...args: unknown[]) => mocks.signOut(...args),
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

vi.mock("src/components/organization/collection-form", () => ({
	CollectionForm: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock("src/components/organization/shelf-form", () => ({
	ShelfForm: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

import { SidebarProvider } from "src/components/ui/sidebar";
import AppSidebar from "./app-sidebar";

function renderSidebar(overrides?: { useSession?: typeof mocks.useSession }) {
	if (overrides?.useSession) {
		mocks.useSession.mockImplementation(overrides.useSession);
	}
	return render(
		<SidebarProvider>
			<AppSidebar />
		</SidebarProvider>,
	);
}

describe("AppSidebar", () => {
	test("renders Excalibre branding", async () => {
		const screen = await renderSidebar();
		await expect.element(screen.getByText("Excalibre")).toBeVisible();
	});

	test("renders Home navigation link", async () => {
		const screen = await renderSidebar();
		await expect.element(screen.getByText("Home")).toBeVisible();
	});

	test("renders Libraries section", async () => {
		const screen = await renderSidebar();
		await expect
			.element(screen.getByText("Libraries", { exact: true }))
			.toBeInTheDocument();
	});

	test("renders Shelves section", async () => {
		const screen = await renderSidebar();
		await expect
			.element(screen.getByText("Shelves", { exact: true }))
			.toBeInTheDocument();
	});

	test("renders Collections section", async () => {
		const screen = await renderSidebar();
		const labels = screen.container.querySelectorAll(
			"[data-slot='sidebar-group-label']",
		);
		const collectionsLabel = Array.from(labels).find(
			(el) => el.textContent === "Collections",
		);
		expect(collectionsLabel).toBeTruthy();
	});

	test("renders Sync Services link in Account section", async () => {
		const screen = await renderSidebar();
		await expect.element(screen.getByText("Sync Services")).toBeInTheDocument();
	});

	test("renders Sign Out button", async () => {
		const screen = await renderSidebar();
		await expect
			.element(screen.getByRole("button", { name: "Sign Out" }))
			.toBeInTheDocument();
	});

	test("shows user email in footer", async () => {
		const screen = await renderSidebar();
		await expect
			.element(screen.getByText("admin@test.com"))
			.toBeInTheDocument();
	});

	test("shows Settings link for admin users", async () => {
		const screen = await renderSidebar();
		await expect.element(screen.getByText("Settings")).toBeInTheDocument();
	});

	test("hides Settings link for non-admin users", async () => {
		const screen = await renderSidebar({
			useSession: () => ({
				data: {
					user: {
						id: "2",
						name: "User",
						email: "user@test.com",
						role: "user",
					},
				},
				isPending: false,
			}),
		});
		await expect.element(screen.getByText("Settings")).not.toBeInTheDocument();
	});

	test("shows empty state when no libraries exist", async () => {
		const screen = await renderSidebar();
		await expect.element(screen.getByText("No libraries yet")).toBeVisible();
	});

	test("shows empty state when no shelves exist", async () => {
		const screen = await renderSidebar();
		await expect.element(screen.getByText("No shelves")).toBeInTheDocument();
	});

	test("shows empty state when no collections exist", async () => {
		const screen = await renderSidebar();
		await expect
			.element(screen.getByText("No collections"))
			.toBeInTheDocument();
	});

	test("renders new shelf button", async () => {
		const screen = await renderSidebar();
		await expect
			.element(screen.getByRole("button", { name: "New shelf" }))
			.toBeInTheDocument();
	});

	test("renders new collection button", async () => {
		const screen = await renderSidebar();
		await expect
			.element(screen.getByRole("button", { name: "New collection" }))
			.toBeInTheDocument();
	});

	test("renders library items when libraries exist", async () => {
		mocks.useQuery.mockImplementation((opts: { queryKey: string[] }) => {
			if (opts.queryKey[0] === "libraries") {
				return {
					data: [
						{ id: 1, name: "Sci-Fi" },
						{ id: 2, name: "History" },
					],
					isLoading: false,
				};
			}
			return { data: [], isLoading: false };
		});

		const screen = await renderSidebar();
		await expect.element(screen.getByText("Sci-Fi")).toBeVisible();
		await expect.element(screen.getByText("History")).toBeVisible();

		mocks.useQuery.mockImplementation(() => ({
			data: [],
			isLoading: false,
		}));
	});
});
