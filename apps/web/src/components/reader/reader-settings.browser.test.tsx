import type { ReaderSettings } from "src/hooks/use-reader-settings";
import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ReaderSettingsPanel } from "./reader-settings";

const DEFAULT_SETTINGS: ReaderSettings = {
	fontSize: 18,
	fontFamily: "Georgia, serif",
	lineHeight: 1.6,
	theme: "dark",
	layout: "paginated",
	margin: 48,
};

describe("ReaderSettingsPanel", () => {
	test("renders sheet with title when open", async () => {
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={vi.fn()}
			/>,
		);

		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.getByText("Reader Settings")).toBeVisible();
	});

	test("does not render dialog when closed", async () => {
		await render(
			<ReaderSettingsPanel
				open={false}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={vi.fn()}
			/>,
		);

		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	test("shows font size section with current value", async () => {
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={vi.fn()}
			/>,
		);

		await expect.element(page.getByText("Font Size")).toBeVisible();
		await expect.element(page.getByText("18px")).toBeVisible();
	});

	test("shows font family section with options", async () => {
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={vi.fn()}
			/>,
		);

		await expect.element(page.getByText("Font Family")).toBeVisible();
		await expect.element(page.getByText("Georgia")).toBeVisible();
		await expect.element(page.getByText("System")).toBeVisible();
		await expect.element(page.getByText("Mono")).toBeVisible();
		await expect.element(page.getByText("Bookerly")).toBeVisible();
	});

	test("shows line height section with current value", async () => {
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={vi.fn()}
			/>,
		);

		await expect.element(page.getByText("Line Height")).toBeVisible();
		await expect.element(page.getByText("1.6")).toBeVisible();
	});

	test("shows theme options", async () => {
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={vi.fn()}
			/>,
		);

		await expect.element(page.getByText("Theme")).toBeVisible();
		await expect.element(page.getByText("Dark")).toBeVisible();
		await expect.element(page.getByText("Light")).toBeVisible();
		await expect.element(page.getByText("Sepia")).toBeVisible();
	});

	test("shows layout options", async () => {
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={vi.fn()}
			/>,
		);

		await expect.element(page.getByText("Layout")).toBeVisible();
		await expect.element(page.getByText("Paginated")).toBeVisible();
		await expect.element(page.getByText("Scrolled")).toBeVisible();
	});

	test("shows margin section with current value", async () => {
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={vi.fn()}
			/>,
		);

		await expect.element(page.getByText("Margin")).toBeVisible();
		await expect.element(page.getByText("48px")).toBeVisible();
	});

	test("shows reset to defaults button", async () => {
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={vi.fn()}
			/>,
		);

		await expect
			.element(page.getByRole("button", { name: "Reset to Defaults" }))
			.toBeVisible();
	});

	test("calls onReset when reset button is clicked", async () => {
		const onReset = vi.fn();
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={vi.fn()}
				onReset={onReset}
			/>,
		);

		await page.getByRole("button", { name: "Reset to Defaults" }).click();
		expect(onReset).toHaveBeenCalledOnce();
	});

	test("calls onUpdateSettings when font family is clicked", async () => {
		const onUpdateSettings = vi.fn();
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={onUpdateSettings}
				onReset={vi.fn()}
			/>,
		);

		await page.getByText("System").click();
		expect(onUpdateSettings).toHaveBeenCalledWith({
			fontFamily: "system-ui, sans-serif",
		});
	});

	test("calls onUpdateSettings when theme is clicked", async () => {
		const onUpdateSettings = vi.fn();
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={onUpdateSettings}
				onReset={vi.fn()}
			/>,
		);

		await page.getByText("Sepia").click();
		expect(onUpdateSettings).toHaveBeenCalledWith({ theme: "sepia" });
	});

	test("calls onUpdateSettings when layout is clicked", async () => {
		const onUpdateSettings = vi.fn();
		await render(
			<ReaderSettingsPanel
				open={true}
				onOpenChange={vi.fn()}
				settings={DEFAULT_SETTINGS}
				onUpdateSettings={onUpdateSettings}
				onReset={vi.fn()}
			/>,
		);

		await page.getByText("Scrolled").click();
		expect(onUpdateSettings).toHaveBeenCalledWith({ layout: "scrolled" });
	});
});
