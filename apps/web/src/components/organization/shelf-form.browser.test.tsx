import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => ({
	createShelfFn: vi.fn(),
	updateShelfFn: vi.fn(),
}));

vi.mock("src/server/shelves", () => ({
	createShelfFn: (...args: unknown[]) => mocks.createShelfFn(...args),
	updateShelfFn: (...args: unknown[]) => mocks.updateShelfFn(...args),
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

import { ShelfForm } from "./shelf-form";

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

describe("ShelfForm", () => {
	test("renders trigger element", async () => {
		const screen = await render(
			<ShelfForm trigger={<button type="button">New Shelf</button>} />,
			{ wrapper: createWrapper() },
		);
		await expect
			.element(screen.getByRole("button", { name: "New Shelf" }))
			.toBeVisible();
	});

	test("opens dialog with create title when no shelf prop", async () => {
		const screen = await render(
			<ShelfForm trigger={<button type="button">New Shelf</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New Shelf" }).click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect
			.element(page.getByRole("heading", { name: "New Shelf" }))
			.toBeVisible();
	});

	test("opens dialog with edit title when shelf prop is provided", async () => {
		const screen = await render(
			<ShelfForm
				shelf={{ id: 1, name: "Favorites", type: "manual" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.getByText("Edit Shelf")).toBeVisible();
	});

	test("pre-fills name input in edit mode", async () => {
		const screen = await render(
			<ShelfForm
				shelf={{ id: 1, name: "Favorites", type: "manual" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		const input = page.getByPlaceholder("My Shelf");
		await expect.element(input).toHaveValue("Favorites");
	});

	test("shows type toggle in create mode", async () => {
		const screen = await render(
			<ShelfForm trigger={<button type="button">New Shelf</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New Shelf" }).click();
		await expect.element(page.getByText("Manual")).toBeVisible();
		await expect.element(page.getByText("Smart")).toBeVisible();
	});

	test("hides type toggle in edit mode", async () => {
		const screen = await render(
			<ShelfForm
				shelf={{ id: 1, name: "Favorites", type: "manual" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		const dialogContent = page.getByRole("dialog");
		await expect.element(dialogContent).toBeVisible();
		// In edit mode, the type field is not rendered — only Name label is present
		await expect.element(page.getByText("Name")).toBeVisible();
	});

	test("shows smart filter builder when Smart type is selected", async () => {
		const screen = await render(
			<ShelfForm trigger={<button type="button">New Shelf</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New Shelf" }).click();
		// Click the "Smart" type button
		await page.getByText("Smart").click();
		// Filter builder should appear
		await expect.element(page.getByText("Filter Rules")).toBeVisible();
		await expect.element(page.getByText("Add Condition")).toBeVisible();
	});

	test("shows create button label when creating", async () => {
		const screen = await render(
			<ShelfForm trigger={<button type="button">New Shelf</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New Shelf" }).click();
		await expect
			.element(page.getByRole("button", { name: "Create Shelf" }))
			.toBeVisible();
	});

	test("shows save changes button label when editing", async () => {
		const screen = await render(
			<ShelfForm
				shelf={{ id: 1, name: "Favorites", type: "manual" }}
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
			<ShelfForm trigger={<button type="button">New Shelf</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New Shelf" }).click();
		const input = page.getByPlaceholder("My Shelf");
		await userEvent.type(input, "My Bookshelf");
		await expect.element(input).toHaveValue("My Bookshelf");
	});

	test("submit create shelf success", async () => {
		mocks.createShelfFn.mockResolvedValue({ id: 1 });
		const screen = await render(
			<ShelfForm trigger={<button type="button">New Shelf</button>} />,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "New Shelf" }).click();
		await userEvent.type(page.getByPlaceholder("My Shelf"), "Reading");
		await page.getByRole("button", { name: "Create Shelf" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});

	test("submit with smart type includes filter rules", async () => {
		mocks.createShelfFn.mockResolvedValue({ id: 2 });
		const screen = await render(
			<ShelfForm trigger={<button type="button">New Shelf</button>} />,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "New Shelf" }).click();
		await userEvent.type(page.getByPlaceholder("My Shelf"), "Smart Shelf");
		await page.getByText("Smart").click();
		await page.getByRole("button", { name: "Create Shelf" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});

	test("submit edit shelf success", async () => {
		mocks.updateShelfFn.mockResolvedValue({ id: 1 });
		const screen = await render(
			<ShelfForm
				shelf={{
					id: 1,
					name: "Favs",
					type: "manual",
					filterRules: null,
				}}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "Edit" }).click();
		await page.getByRole("button", { name: "Save Changes" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});

	test("submit shows error toast on failure", async () => {
		mocks.createShelfFn.mockRejectedValue(new Error("Server error"));
		const screen = await render(
			<ShelfForm trigger={<button type="button">New Shelf</button>} />,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "New Shelf" }).click();
		await userEvent.type(page.getByPlaceholder("My Shelf"), "Shelf");
		await page.getByRole("button", { name: "Create Shelf" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});

	test("closing dialog resets form state", async () => {
		const screen = await render(
			<ShelfForm
				shelf={{
					id: 1,
					name: "Favs",
					type: "smart",
					filterRules: { operator: "or", conditions: [] },
				}}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "Edit" }).click();
		// Press Escape to close
		await page
			.getByRole("dialog")
			.element()
			.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
			);
	});
});
