import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		...rest
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => <a {...rest}>{children}</a>,
}));

import { ReaderToolbar } from "./reader-toolbar";

describe("ReaderToolbar", () => {
	const defaultProps = {
		bookId: 1,
		bookTitle: "Test Book",
		onToggleToc: vi.fn(),
		onToggleSettings: vi.fn(),
		visible: true,
	};

	test("renders book title", async () => {
		const screen = await render(<ReaderToolbar {...defaultProps} />);
		await expect.element(screen.getByText("Test Book")).toBeVisible();
	});

	test("renders chapter title when provided", async () => {
		const screen = await render(
			<ReaderToolbar {...defaultProps} chapterTitle="Chapter 3: The Quest" />,
		);
		await expect
			.element(screen.getByText("Chapter 3: The Quest"))
			.toBeVisible();
	});

	test("does not render chapter title when not provided", async () => {
		const screen = await render(<ReaderToolbar {...defaultProps} />);
		await expect
			.element(screen.getByText("Chapter 3: The Quest"))
			.not.toBeInTheDocument();
	});

	test("renders back to book details button", async () => {
		const screen = await render(<ReaderToolbar {...defaultProps} />);
		await expect
			.element(screen.getByRole("button", { name: "Back to book details" }))
			.toBeVisible();
	});

	test("renders table of contents button", async () => {
		const screen = await render(<ReaderToolbar {...defaultProps} />);
		await expect
			.element(screen.getByRole("button", { name: "Table of contents" }))
			.toBeVisible();
	});

	test("renders reader settings button", async () => {
		const screen = await render(<ReaderToolbar {...defaultProps} />);
		await expect
			.element(screen.getByRole("button", { name: "Reader settings" }))
			.toBeVisible();
	});

	test("renders bookmark button", async () => {
		const screen = await render(<ReaderToolbar {...defaultProps} />);
		await expect
			.element(screen.getByRole("button", { name: "Bookmark" }))
			.toBeVisible();
	});

	test("calls onToggleToc when TOC button is clicked", async () => {
		const onToggleToc = vi.fn();
		const screen = await render(
			<ReaderToolbar {...defaultProps} onToggleToc={onToggleToc} />,
		);
		await screen.getByRole("button", { name: "Table of contents" }).click();
		expect(onToggleToc).toHaveBeenCalledOnce();
	});

	test("calls onToggleSettings when settings button is clicked", async () => {
		const onToggleSettings = vi.fn();
		const screen = await render(
			<ReaderToolbar {...defaultProps} onToggleSettings={onToggleSettings} />,
		);
		await screen.getByRole("button", { name: "Reader settings" }).click();
		expect(onToggleSettings).toHaveBeenCalledOnce();
	});
});
