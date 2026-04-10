import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => ({
	createLibraryFn: vi.fn(),
	updateLibraryFn: vi.fn(),
}));

vi.mock("src/server/libraries", () => ({
	createLibraryFn: (...args: unknown[]) => mocks.createLibraryFn(...args),
	updateLibraryFn: (...args: unknown[]) => mocks.updateLibraryFn(...args),
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

import { LibraryForm } from "./library-form";

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

describe("LibraryForm", () => {
	test("renders trigger element", async () => {
		const screen = await render(
			<LibraryForm trigger={<button type="button">Add Library</button>} />,
			{ wrapper: createWrapper() },
		);
		await expect
			.element(screen.getByRole("button", { name: "Add Library" }))
			.toBeVisible();
	});

	test("opens dialog with create title when no library prop", async () => {
		const screen = await render(
			<LibraryForm trigger={<button type="button">Add Library</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Add Library" }).click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect
			.element(page.getByRole("heading", { name: "Add Library" }))
			.toBeVisible();
	});

	test("opens dialog with edit title when library prop is provided", async () => {
		const screen = await render(
			<LibraryForm
				library={{
					id: 1,
					name: "Books",
					type: "book",
					scanPaths: ["/data/books"],
					scanInterval: 30,
				}}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect
			.element(page.getByRole("heading", { name: "Edit Library" }))
			.toBeVisible();
	});

	test("pre-fills name input in edit mode", async () => {
		const screen = await render(
			<LibraryForm
				library={{
					id: 1,
					name: "Books",
					type: "book",
					scanPaths: ["/data/books"],
					scanInterval: 30,
				}}
				trigger={<button type="button">Edit</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Edit" }).click();
		const input = page.getByPlaceholder("My Library");
		await expect.element(input).toHaveValue("Books");
	});

	test("shows scan paths section with add path button", async () => {
		const screen = await render(
			<LibraryForm trigger={<button type="button">Add Library</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Add Library" }).click();
		await expect.element(page.getByText("Scan Paths")).toBeVisible();
		await expect
			.element(page.getByRole("button", { name: /Add Path/i }))
			.toBeVisible();
	});

	test("shows scan interval field", async () => {
		const screen = await render(
			<LibraryForm trigger={<button type="button">Add Library</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Add Library" }).click();
		await expect
			.element(page.getByText("Scan Interval (minutes)"))
			.toBeVisible();
	});

	test("shows create button label when creating", async () => {
		const screen = await render(
			<LibraryForm trigger={<button type="button">Add Library</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Add Library" }).click();
		await expect
			.element(page.getByRole("button", { name: "Create Library" }))
			.toBeVisible();
	});

	test("shows save changes button label when editing", async () => {
		const screen = await render(
			<LibraryForm
				library={{
					id: 1,
					name: "Books",
					type: "book",
					scanPaths: ["/data/books"],
					scanInterval: 30,
				}}
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
			<LibraryForm trigger={<button type="button">Add Library</button>} />,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Add Library" }).click();
		const input = page.getByPlaceholder("My Library");
		await userEvent.type(input, "Comics");
		await expect.element(input).toHaveValue("Comics");
	});
});
