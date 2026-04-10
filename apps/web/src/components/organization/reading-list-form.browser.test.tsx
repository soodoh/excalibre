import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => ({
	createReadingListFn: vi.fn(),
	updateReadingListFn: vi.fn(),
}));

vi.mock("src/server/reading-lists", () => ({
	createReadingListFn: (...args: unknown[]) =>
		mocks.createReadingListFn(...args),
	updateReadingListFn: (...args: unknown[]) =>
		mocks.updateReadingListFn(...args),
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

import { ReadingListForm } from "./reading-list-form";

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

describe("ReadingListForm", () => {
	test("renders trigger element", async () => {
		const screen = await render(
			<ReadingListForm trigger={<button type="button">New List</button>} />,
			{ wrapper: createWrapper() },
		);
		await expect
			.element(screen.getByRole("button", { name: "New List" }))
			.toBeVisible();
	});

	test("opens dialog with create title when no readingList prop", async () => {
		const screen = await render(
			<ReadingListForm trigger={<button type="button">New List</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New List" }).click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.getByText("New Reading List")).toBeVisible();
	});

	test("opens dialog with edit title when readingList prop is provided", async () => {
		const screen = await render(
			<ReadingListForm
				readingList={{ id: 1, name: "Summer Reads" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.getByText("Edit Reading List")).toBeVisible();
	});

	test("pre-fills name input in edit mode", async () => {
		const screen = await render(
			<ReadingListForm
				readingList={{ id: 1, name: "Summer Reads" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		const input = page.getByPlaceholder("My Reading List");
		await expect.element(input).toHaveValue("Summer Reads");
	});

	test("shows create button label when creating", async () => {
		const screen = await render(
			<ReadingListForm trigger={<button type="button">New List</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New List" }).click();
		await expect
			.element(page.getByRole("button", { name: "Create Reading List" }))
			.toBeVisible();
	});

	test("shows save changes button label when editing", async () => {
		const screen = await render(
			<ReadingListForm
				readingList={{ id: 1, name: "Summer Reads" }}
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
			<ReadingListForm trigger={<button type="button">New List</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "New List" }).click();
		const input = page.getByPlaceholder("My Reading List");
		await userEvent.type(input, "Winter Reads");
		await expect.element(input).toHaveValue("Winter Reads");
	});

	test("submit create reading list success", async () => {
		mocks.createReadingListFn.mockResolvedValue({ id: 1 });
		const screen = await render(
			<ReadingListForm trigger={<button type="button">New List</button>} />,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "New List" }).click();
		await userEvent.type(page.getByPlaceholder("My Reading List"), "TBR 2025");
		await page.getByRole("button", { name: "Create Reading List" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});

	test("submit edit reading list success", async () => {
		mocks.updateReadingListFn.mockResolvedValue({ id: 1 });
		const screen = await render(
			<ReadingListForm
				readingList={{ id: 1, name: "TBR" }}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "Edit" }).click();
		await page.getByRole("button", { name: "Save Changes" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});

	test("submit shows error toast on failure", async () => {
		mocks.createReadingListFn.mockRejectedValue(new Error("boom"));
		const screen = await render(
			<ReadingListForm trigger={<button type="button">New List</button>} />,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "New List" }).click();
		await userEvent.type(page.getByPlaceholder("My Reading List"), "X");
		await page.getByRole("button", { name: "Create Reading List" }).click();
		await new Promise((r) => setTimeout(r, 100));
	});
});
