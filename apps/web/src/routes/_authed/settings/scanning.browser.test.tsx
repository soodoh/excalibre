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

	test("renders library with lastScannedAt times", async () => {
		const now = new Date();
		mocks.useQuery.mockReturnValue({
			data: [
				{
					id: 1,
					name: "Recent",
					type: "ebook",
					scanInterval: 60,
					lastScannedAt: new Date(now.getTime() - 30 * 1000),
				},
				{
					id: 2,
					name: "Minutes",
					type: "ebook",
					scanInterval: 60,
					lastScannedAt: new Date(now.getTime() - 5 * 60 * 1000),
				},
				{
					id: 3,
					name: "Hours",
					type: "ebook",
					scanInterval: 60,
					lastScannedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
				},
				{
					id: 4,
					name: "Days",
					type: "ebook",
					scanInterval: 60,
					lastScannedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
				},
				{
					id: 5,
					name: "OneMin",
					type: "ebook",
					scanInterval: 60,
					lastScannedAt: new Date(now.getTime() - 60 * 1000),
				},
				{
					id: 6,
					name: "OneHour",
					type: "ebook",
					scanInterval: 60,
					lastScannedAt: new Date(now.getTime() - 60 * 60 * 1000),
				},
				{
					id: 7,
					name: "OneDay",
					type: "ebook",
					scanInterval: 60,
					lastScannedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
				},
			],
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
	});

	test("mutation onSuccess and onError handlers", async () => {
		mocks.resetMutations();
		mocks.useQuery.mockReturnValue({
			data: [
				{
					id: 1,
					name: "Lib",
					type: "ebook",
					scanInterval: 60,
					lastScannedAt: null,
				},
			],
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		// ScanningSettingsPage's scanAllMutation is registered first, then the
		// LibraryRow's scanMutation during child render.
		const scanAllMut = mocks.mutations[0];
		await scanAllMut?.onSuccess?.({ added: 1, updated: 2, missing: 3 });
		scanAllMut?.onError?.(new Error("all-fail"));
		scanAllMut?.onError?.(new Error(""));
		await scanAllMut?.mutationFn?.();

		const rowMut = mocks.mutations[1];
		await rowMut?.onSuccess?.({ added: 5, updated: 6, missing: 7 });
		rowMut?.onError?.(new Error("row-fail"));
		rowMut?.onError?.(new Error(""));
		await rowMut?.mutationFn?.();
	});
});
