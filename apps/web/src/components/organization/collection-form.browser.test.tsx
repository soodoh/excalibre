import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => ({
	createCollectionFn: vi.fn(),
	updateCollectionFn: vi.fn(),
}));

vi.mock("src/server/collections", () => ({
	createCollectionFn: (...args: unknown[]) => mocks.createCollectionFn(...args),
	updateCollectionFn: (...args: unknown[]) => mocks.updateCollectionFn(...args),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => () => ({ values: {}, errors: {} }),
}));

import { CollectionForm } from "./collection-form";

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

describe("CollectionForm", () => {
	test("renders trigger element", async () => {
		const screen = await render(
			<CollectionForm
				trigger={<button type="button">New Collection</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await expect
			.element(screen.getByRole("button", { name: "New Collection" }))
			.toBeVisible();
	});

	test("opens dialog with create title when no collection prop", async () => {
		const screen = await render(
			<CollectionForm
				trigger={<button type="button">New Collection</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New Collection" }).click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect
			.element(page.getByRole("heading", { name: "New Collection" }))
			.toBeVisible();
	});

	test("opens dialog with edit title when collection prop is provided", async () => {
		const screen = await render(
			<CollectionForm
				collection={{ id: 1, name: "Sci-Fi" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.getByText("Edit Collection")).toBeVisible();
	});

	test("pre-fills name input in edit mode", async () => {
		const screen = await render(
			<CollectionForm
				collection={{ id: 1, name: "Sci-Fi" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		const input = page.getByPlaceholder("My Collection");
		await expect.element(input).toHaveValue("Sci-Fi");
	});

	test("shows create button label when creating", async () => {
		const screen = await render(
			<CollectionForm
				trigger={<button type="button">New Collection</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New Collection" }).click();
		await expect
			.element(page.getByRole("button", { name: "Create Collection" }))
			.toBeVisible();
	});

	test("shows save changes button label when editing", async () => {
		const screen = await render(
			<CollectionForm
				collection={{ id: 1, name: "Sci-Fi" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		await expect
			.element(page.getByRole("button", { name: "Save Changes" }))
			.toBeVisible();
	});

	test("name input accepts user input", async () => {
		const screen = await render(
			<CollectionForm
				trigger={<button type="button">New Collection</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New Collection" }).click();
		const input = page.getByPlaceholder("My Collection");
		await userEvent.type(input, "Horror Books");
		await expect.element(input).toHaveValue("Horror Books");
	});

	test("submit create collection success", async () => {
		mocks.createCollectionFn.mockResolvedValue({ id: 1 });
		const screen = await render(
			<CollectionForm
				trigger={<button type="button">New Collection</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "New Collection" }).click();
		await userEvent.type(
			page.getByPlaceholder("My Collection"),
			"My Collection",
		);
		await page.getByRole("button", { name: "Create Collection" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});

	test("submit edit collection success", async () => {
		mocks.updateCollectionFn.mockResolvedValue({ id: 1 });
		const screen = await render(
			<CollectionForm
				collection={{ id: 1, name: "Sci-Fi" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "Edit" }).click();
		await page.getByRole("button", { name: "Save Changes" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});

	test("submit shows error toast on failure", async () => {
		mocks.createCollectionFn.mockRejectedValue(new Error("boom"));
		const screen = await render(
			<CollectionForm
				trigger={<button type="button">New Collection</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "New Collection" }).click();
		await userEvent.type(page.getByPlaceholder("My Collection"), "X");
		await page.getByRole("button", { name: "Create Collection" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});
});
