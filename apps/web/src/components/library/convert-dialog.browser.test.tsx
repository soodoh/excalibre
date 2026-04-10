import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => ({
	getSupportedConversionsFn: vi.fn(),
	requestConversionFn: vi.fn(),
}));

vi.mock("src/server/conversion", () => ({
	getSupportedConversionsFn: (...args: unknown[]) =>
		mocks.getSupportedConversionsFn(...args),
	requestConversionFn: (...args: unknown[]) =>
		mocks.requestConversionFn(...args),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

import { ConvertDialog } from "./convert-dialog";

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

const defaultBookFile = {
	id: 10,
	format: "epub",
	fileSize: 1048576,
};

describe("ConvertDialog", () => {
	test("renders the trigger element", async () => {
		const screen = await render(
			<ConvertDialog
				bookFile={defaultBookFile}
				bookId={1}
				trigger={<button type="button">Convert</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await expect
			.element(screen.getByRole("button", { name: "Convert" }))
			.toBeVisible();
	});

	test("opens dialog when trigger is clicked", async () => {
		mocks.getSupportedConversionsFn.mockResolvedValue(["pdf", "mobi"]);

		const screen = await render(
			<ConvertDialog
				bookFile={defaultBookFile}
				bookId={1}
				trigger={<button type="button">Convert</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Convert" }).click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.getByText("Convert Book File")).toBeVisible();
	});

	test("shows source format and file size", async () => {
		mocks.getSupportedConversionsFn.mockResolvedValue(["pdf"]);

		const screen = await render(
			<ConvertDialog
				bookFile={defaultBookFile}
				bookId={1}
				trigger={<button type="button">Convert</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Convert" }).click();
		await expect.element(page.getByText("EPUB")).toBeVisible();
		await expect.element(page.getByText("1.0 MB")).toBeVisible();
	});

	test("shows unknown file size when null", async () => {
		mocks.getSupportedConversionsFn.mockResolvedValue(["pdf"]);

		const screen = await render(
			<ConvertDialog
				bookFile={{ id: 10, format: "epub", fileSize: null }}
				bookId={1}
				trigger={<button type="button">Convert</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Convert" }).click();
		await expect.element(page.getByText("Unknown")).toBeVisible();
	});

	test("convert button is disabled when no target format selected", async () => {
		mocks.getSupportedConversionsFn.mockResolvedValue(["pdf", "mobi"]);

		const screen = await render(
			<ConvertDialog
				bookFile={defaultBookFile}
				bookId={1}
				trigger={<button type="button">Convert</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Convert" }).click();
		// Wait for formats to load
		await expect.element(page.getByText("Select a format...")).toBeVisible();

		// The "Convert" button inside the dialog should be disabled
		const buttons = page.getByRole("button", { name: "Convert" }).all();
		// The last one is the submit button inside the dialog
		const submitButton = buttons[buttons.length - 1];
		await expect.element(submitButton).toBeDisabled();
	});

	test("shows no supported conversions message", async () => {
		mocks.getSupportedConversionsFn.mockResolvedValue([]);
		const screen = await render(
			<ConvertDialog
				bookFile={defaultBookFile}
				bookId={1}
				trigger={<button type="button">Convert</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "Convert" }).click();
		await expect
			.element(page.getByText("No supported conversions for this format."))
			.toBeVisible();
	});

	test("humanFileSize renders small bytes", async () => {
		mocks.getSupportedConversionsFn.mockResolvedValue(["pdf"]);
		const screen = await render(
			<ConvertDialog
				bookFile={{ id: 10, format: "epub", fileSize: 500 }}
				bookId={1}
				trigger={<button type="button">Convert</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "Convert" }).click();
		await expect.element(page.getByText("500 B")).toBeVisible();
	});

	test("humanFileSize renders KB range", async () => {
		mocks.getSupportedConversionsFn.mockResolvedValue(["pdf"]);
		const screen = await render(
			<ConvertDialog
				bookFile={{ id: 10, format: "epub", fileSize: 500 * 1024 }}
				bookId={1}
				trigger={<button type="button">Convert</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await screen.getByRole("button", { name: "Convert" }).click();
		await expect.element(page.getByText("500.0 KB")).toBeVisible();
	});
});
