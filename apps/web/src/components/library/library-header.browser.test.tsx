import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import LibraryHeader from "./library-header";

describe("LibraryHeader", () => {
	const defaultProps = {
		library: { id: 1, name: "My Library" },
		bookCount: 42,
		search: "",
		onSearchChange: vi.fn(),
		onScan: vi.fn(),
		isScanning: false,
		isAdmin: true,
	};

	test("renders library name", async () => {
		const screen = await render(<LibraryHeader {...defaultProps} />);
		await expect.element(screen.getByText("My Library")).toBeVisible();
	});

	test("renders book count badge", async () => {
		const screen = await render(<LibraryHeader {...defaultProps} />);
		await expect.element(screen.getByText("42 books")).toBeVisible();
	});

	test("renders search input with placeholder", async () => {
		const screen = await render(<LibraryHeader {...defaultProps} />);
		await expect
			.element(screen.getByPlaceholder("Search books..."))
			.toBeVisible();
	});

	test("renders search input with current value", async () => {
		const screen = await render(
			<LibraryHeader {...defaultProps} search="fantasy" />,
		);
		const input = screen.getByPlaceholder("Search books...");
		await expect.element(input).toHaveValue("fantasy");
	});

	test("shows scan button for admin users", async () => {
		const screen = await render(<LibraryHeader {...defaultProps} />);
		await expect
			.element(screen.getByRole("button", { name: /Scan Now/i }))
			.toBeVisible();
	});

	test("hides scan button for non-admin users", async () => {
		const screen = await render(
			<LibraryHeader {...defaultProps} isAdmin={false} />,
		);
		await expect
			.element(screen.getByRole("button", { name: /Scan/i }))
			.not.toBeInTheDocument();
	});

	test("shows scanning state on scan button", async () => {
		const screen = await render(
			<LibraryHeader {...defaultProps} isScanning={true} />,
		);
		const button = screen.getByRole("button", { name: /Scanning/i });
		await expect.element(button).toBeVisible();
		await expect.element(button).toBeDisabled();
	});

	test("calls onScan when scan button is clicked", async () => {
		const onScan = vi.fn();
		const screen = await render(
			<LibraryHeader {...defaultProps} onScan={onScan} />,
		);
		await screen.getByRole("button", { name: /Scan Now/i }).click();
		expect(onScan).toHaveBeenCalledOnce();
	});

	test("calls onSearchChange as the user types", async () => {
		const onSearchChange = vi.fn();
		const screen = await render(
			<LibraryHeader {...defaultProps} onSearchChange={onSearchChange} />,
		);
		await screen.getByPlaceholder("Search books...").fill("mystery");
		expect(onSearchChange).toHaveBeenCalled();
	});
});
