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
	getLibrariesFn: vi.fn(),
}));

vi.mock("src/server/middleware", () => ({
	getAuthSessionFn: vi.fn(),
}));

vi.mock("src/server/scan-actions", () => ({
	triggerScanAllFn: vi.fn(),
	triggerScanFn: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import "./scanning";

type ComponentType = () => React.JSX.Element;

describe("ScanningSettingsPage", () => {
	test("shows loading state", async () => {
		mocks.useQuery.mockReturnValue({ data: undefined, isLoading: true });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByText("Loading libraries..."))
			.toBeVisible();
	});

	test("shows empty state when no libraries configured", async () => {
		mocks.useQuery.mockReturnValue({ data: [], isLoading: false });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(
				screen.getByText(
					"No libraries configured. Add a library in the Libraries settings.",
				),
			)
			.toBeVisible();
	});

	test("renders library rows with scan button", async () => {
		mocks.useQuery.mockReturnValue({
			data: [
				{
					id: 1,
					name: "Fiction",
					type: "ebook",
					scanInterval: 60,
					lastScannedAt: null,
				},
			],
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Fiction")).toBeVisible();
		await expect
			.element(screen.getByRole("button", { name: /Scan Now/i }))
			.toBeVisible();
	});

	test("renders page title and Scan All button", async () => {
		mocks.useQuery.mockReturnValue({ data: [], isLoading: false });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "Scanning" }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("button", { name: /Scan All Libraries/i }))
			.toBeVisible();
	});
});
