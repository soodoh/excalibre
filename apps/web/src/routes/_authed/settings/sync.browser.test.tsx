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

vi.mock("src/server/middleware", () => ({
	getAuthSessionFn: vi.fn(),
}));

vi.mock("src/server/sync-settings", () => ({
	createKoboTokenFn: vi.fn(),
	deleteKoboTokenFn: vi.fn(),
	getKoboTokensFn: vi.fn(),
	getOpdsKeyFn: vi.fn(),
	regenerateOpdsKeyFn: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import "./sync";

type ComponentType = () => React.JSX.Element;

function setQueries(tokens: unknown, opdsKey: unknown) {
	mocks.useQuery.mockImplementation((opts: { queryKey: unknown[] }) => {
		const key = JSON.stringify(opts.queryKey);
		if (key.includes("koboTokens")) {
			return { data: tokens, isLoading: false };
		}
		if (key.includes("opdsKey")) {
			return { data: opdsKey, isLoading: false };
		}
		return { data: undefined, isLoading: false };
	});
}

describe("SyncSettingsPage", () => {
	test("renders page title and description", async () => {
		setQueries([], null);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "Sync Services" }))
			.toBeVisible();
	});

	test("renders all three sections (KOSync, Kobo, OPDS)", async () => {
		setQueries([], null);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("KOSync (KOReader)")).toBeVisible();
		await expect.element(screen.getByText("Kobo Sync")).toBeVisible();
		await expect
			.element(screen.getByText("OPDS Feed", { exact: true }))
			.toBeVisible();
	});

	test("shows empty kobo device state", async () => {
		setQueries([], null);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByText(/No Kobo devices configured/i))
			.toBeVisible();
	});

	test("renders kobo devices when present", async () => {
		setQueries(
			[
				{
					id: 1,
					tokenPreview: "abc***",
					deviceName: "My Kobo",
					createdAt: new Date(),
				},
			],
			{ id: 1, apiKey: "masked***", createdAt: new Date() },
		);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("My Kobo")).toBeVisible();
	});

	test("renders Regenerate button for OPDS", async () => {
		setQueries([], { id: 1, apiKey: "masked***", createdAt: new Date() });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("button", { name: /Regenerate API Key/i }))
			.toBeVisible();
	});
});
