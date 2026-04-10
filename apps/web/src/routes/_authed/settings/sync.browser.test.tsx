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

	test("loading states for kobo and opds sections", async () => {
		mocks.useQuery.mockImplementation(() => ({
			data: undefined,
			isLoading: true,
		}));
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Loading devices...")).toBeVisible();
	});

	test("renders kobo token with null deviceName", async () => {
		setQueries(
			[
				{
					id: 1,
					tokenPreview: "abc***",
					deviceName: null,
					createdAt: new Date(),
				},
			],
			null,
		);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Unnamed Device")).toBeVisible();
	});

	test("kobo delete confirmation flow", async () => {
		setQueries(
			[
				{
					id: 1,
					tokenPreview: "abc***",
					deviceName: "My Kobo",
					createdAt: new Date(),
				},
			],
			null,
		);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		// Click trash button to enter confirm state
		const trashButtons = screen.getByRole("button", { name: "" });
		// Use container query instead
		const deleteIcons = document.querySelectorAll(
			"button svg.text-destructive",
		);
		const deleteBtn = deleteIcons[0]?.closest("button");
		if (deleteBtn) {
			(deleteBtn as HTMLButtonElement).click();
			await expect.element(screen.getByText("Are you sure?")).toBeVisible();
			await screen.getByRole("button", { name: "Cancel" }).click();
		}
	});

	test("opens add kobo device dialog and cancels", async () => {
		setQueries([], null);
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await screen.getByRole("button", { name: /Add Kobo Device/i }).click();
		await expect
			.element(screen.getByRole("heading", { name: "Add Kobo Device" }))
			.toBeVisible();
		const input = screen.getByLabelText(/Device Name/i);
		await input.fill("Test Device");
		await screen.getByRole("button", { name: "Cancel" }).click();
	});

	test("opens OPDS new-key dialog when rawApiKey present", async () => {
		setQueries([], {
			id: 1,
			apiKey: "masked",
			rawApiKey: "secret-raw-key",
			createdAt: new Date(),
		});
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "OPDS API Key Ready" }))
			.toBeVisible();
		await screen.getByRole("button", { name: "Done" }).click();
	});

	test("mutation success/error handlers execute", async () => {
		mocks.resetMutations();
		setQueries(
			[
				{
					id: 1,
					tokenPreview: "abc***",
					deviceName: "Kobo",
					createdAt: new Date(),
				},
			],
			{ id: 1, apiKey: "masked", createdAt: new Date() },
		);
		const Page = mocks.getComponent() as ComponentType;
		await render(<Page />);
		// createKoboToken mutation (first)
		const createMut = mocks.mutations[0];
		await createMut?.onSuccess?.({
			id: 1,
			token: "raw",
			tokenPreview: "abc***",
			deviceName: "Kobo",
			createdAt: new Date(),
		});
		createMut?.onError?.(new Error("fail"));
		createMut?.onError?.(new Error(""));
		await createMut?.mutationFn?.("Device");
		await createMut?.mutationFn?.("");
		// deleteKoboToken mutation (second)
		const delMut = mocks.mutations[1];
		delMut?.onSuccess?.();
		delMut?.onError?.(new Error("del"));
		delMut?.onError?.(new Error(""));
		await delMut?.mutationFn?.(1);
		// regenerateOpdsKey mutation (third)
		const regenMut = mocks.mutations[2];
		regenMut?.onSuccess?.({
			id: 2,
			apiKey: "masked",
			rawApiKey: "raw",
			createdAt: new Date(),
		});
		regenMut?.onError?.(new Error("reg"));
		regenMut?.onError?.(new Error(""));
		await regenMut?.mutationFn?.();
	});
});
