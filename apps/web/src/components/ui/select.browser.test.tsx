import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "./select";

describe("Select", () => {
	test("renders trigger with placeholder", async () => {
		const screen = await render(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Choose..." />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">Option A</SelectItem>
					<SelectItem value="b">Option B</SelectItem>
				</SelectContent>
			</Select>,
		);

		await expect.element(screen.getByText("Choose...")).toBeVisible();
	});

	test("opens dropdown when trigger is clicked", async () => {
		const screen = await render(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Pick one" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">Option A</SelectItem>
					<SelectItem value="b">Option B</SelectItem>
				</SelectContent>
			</Select>,
		);

		await screen.getByRole("combobox").click();
		// Options render in a portal via listbox
		await expect.element(page.getByRole("listbox")).toBeVisible();
		await expect
			.element(page.getByRole("option", { name: "Option A" }))
			.toBeVisible();
		await expect
			.element(page.getByRole("option", { name: "Option B" }))
			.toBeVisible();
	});

	test("selects an option when clicked", async () => {
		const screen = await render(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Pick one" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">Option A</SelectItem>
					<SelectItem value="b">Option B</SelectItem>
				</SelectContent>
			</Select>,
		);

		await screen.getByRole("combobox").click();
		await page.getByRole("option", { name: "Option B" }).click();

		// After selection, the trigger should show selected value
		await expect.element(screen.getByText("Option B")).toBeVisible();
	});

	test("calls onValueChange when selection changes", async () => {
		const onValueChange = vi.fn();
		const screen = await render(
			<Select onValueChange={onValueChange}>
				<SelectTrigger>
					<SelectValue placeholder="Pick" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="first">First</SelectItem>
					<SelectItem value="second">Second</SelectItem>
				</SelectContent>
			</Select>,
		);

		await screen.getByRole("combobox").click();
		await page.getByRole("option", { name: "First" }).click();
		expect(onValueChange).toHaveBeenCalledWith("first");
	});

	test("renders with groups and labels", async () => {
		const screen = await render(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Pick" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Fruits</SelectLabel>
						<SelectItem value="apple">Apple</SelectItem>
						<SelectItem value="banana">Banana</SelectItem>
					</SelectGroup>
					<SelectSeparator />
					<SelectGroup>
						<SelectLabel>Vegetables</SelectLabel>
						<SelectItem value="carrot">Carrot</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>,
		);

		await screen.getByRole("combobox").click();
		await expect.element(page.getByText("Fruits")).toBeVisible();
		await expect.element(page.getByText("Vegetables")).toBeVisible();
		await expect
			.element(page.getByRole("option", { name: "Apple" }))
			.toBeVisible();
	});

	test("renders with size variant", async () => {
		const screen = await render(
			<Select>
				<SelectTrigger size="sm">
					<SelectValue placeholder="Small" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">A</SelectItem>
				</SelectContent>
			</Select>,
		);

		const trigger = screen.getByRole("combobox");
		await expect.element(trigger).toHaveAttribute("data-size", "sm");
	});

	test("renders with disabled state", async () => {
		const screen = await render(
			<Select disabled>
				<SelectTrigger>
					<SelectValue placeholder="Disabled" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">A</SelectItem>
				</SelectContent>
			</Select>,
		);

		const trigger = screen.getByRole("combobox");
		await expect.element(trigger).toBeDisabled();
	});
});
