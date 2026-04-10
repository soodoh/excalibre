import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
	test("renders trigger", async () => {
		const screen = await render(
			<DropdownMenu>
				<DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>Item 1</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		await expect.element(screen.getByText("Open Menu")).toBeVisible();
	});

	test("opens menu when trigger is clicked", async () => {
		const screen = await render(
			<DropdownMenu>
				<DropdownMenuTrigger>Open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>Action 1</DropdownMenuItem>
					<DropdownMenuItem>Action 2</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		await screen.getByText("Open").click();
		await expect.element(page.getByRole("menu")).toBeVisible();
		await expect
			.element(page.getByRole("menuitem", { name: "Action 1" }))
			.toBeVisible();
		await expect
			.element(page.getByRole("menuitem", { name: "Action 2" }))
			.toBeVisible();
	});

	test("closes menu when item is clicked", async () => {
		const onSelect = vi.fn();
		const screen = await render(
			<DropdownMenu>
				<DropdownMenuTrigger>Open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem onSelect={onSelect}>Click me</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		await screen.getByText("Open").click();
		await page.getByRole("menuitem", { name: "Click me" }).click();
		expect(onSelect).toHaveBeenCalled();
	});

	test("renders with labels and groups", async () => {
		const screen = await render(
			<DropdownMenu>
				<DropdownMenuTrigger>Open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuLabel>My Account</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem>Profile</DropdownMenuItem>
						<DropdownMenuItem>Settings</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		await screen.getByText("Open").click();
		await expect.element(page.getByText("My Account")).toBeVisible();
		await expect
			.element(page.getByRole("menuitem", { name: "Profile" }))
			.toBeVisible();
		await expect
			.element(page.getByRole("menuitem", { name: "Settings" }))
			.toBeVisible();
	});

	test("renders destructive variant item", async () => {
		const screen = await render(
			<DropdownMenu>
				<DropdownMenuTrigger>Open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		await screen.getByText("Open").click();
		const item = page.getByRole("menuitem", { name: "Delete" });
		await expect.element(item).toHaveAttribute("data-variant", "destructive");
	});

	test("renders checkbox items", async () => {
		const screen = await render(
			<DropdownMenu>
				<DropdownMenuTrigger>Open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuCheckboxItem checked>
						Checked item
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem checked={false}>
						Unchecked item
					</DropdownMenuCheckboxItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		await screen.getByText("Open").click();
		await expect.element(page.getByRole("menu")).toBeVisible();

		const checkboxItems = page.getByRole("menuitemcheckbox").all();
		expect(checkboxItems).toHaveLength(2);

		await expect
			.element(
				page.getByRole("menuitemcheckbox", {
					name: "Checked item",
					exact: true,
				}),
			)
			.toHaveAttribute("aria-checked", "true");

		await expect
			.element(
				page.getByRole("menuitemcheckbox", {
					name: "Unchecked item",
					exact: true,
				}),
			)
			.toHaveAttribute("aria-checked", "false");
	});

	test("renders radio group items", async () => {
		const screen = await render(
			<DropdownMenu>
				<DropdownMenuTrigger>Open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuRadioGroup value="a">
						<DropdownMenuRadioItem value="a">Radio A</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="b">Radio B</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		await screen.getByText("Open").click();
		const radioA = page.getByRole("menuitemradio", { name: "Radio A" });
		await expect.element(radioA).toBeVisible();
		await expect.element(radioA).toHaveAttribute("aria-checked", "true");

		const radioB = page.getByRole("menuitemradio", { name: "Radio B" });
		await expect.element(radioB).toHaveAttribute("aria-checked", "false");
	});

	test("renders shortcut text", async () => {
		const screen = await render(
			<DropdownMenu>
				<DropdownMenuTrigger>Open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>
						Save
						<DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		await screen.getByText("Open").click();
		await expect.element(page.getByText("Ctrl+S")).toBeVisible();
	});
});
