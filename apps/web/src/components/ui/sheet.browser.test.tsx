import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "./sheet";

describe("Sheet", () => {
	test("renders trigger button", async () => {
		const screen = await render(
			<Sheet>
				<SheetTrigger>Open Sheet</SheetTrigger>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Title</SheetTitle>
						<SheetDescription>Description</SheetDescription>
					</SheetHeader>
				</SheetContent>
			</Sheet>,
		);
		await expect.element(screen.getByText("Open Sheet")).toBeVisible();
	});

	test("opens when trigger is clicked", async () => {
		const screen = await render(
			<Sheet>
				<SheetTrigger>Open</SheetTrigger>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Sheet Title</SheetTitle>
						<SheetDescription>Sheet description</SheetDescription>
					</SheetHeader>
				</SheetContent>
			</Sheet>,
		);

		await screen.getByText("Open").click();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.getByText("Sheet Title")).toBeVisible();
		await expect.element(page.getByText("Sheet description")).toBeVisible();
	});

	test("closes when close button is clicked", async () => {
		const screen = await render(
			<Sheet>
				<SheetTrigger>Open</SheetTrigger>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Title</SheetTitle>
						<SheetDescription>Desc</SheetDescription>
					</SheetHeader>
				</SheetContent>
			</Sheet>,
		);

		await screen.getByText("Open").click();
		await expect.element(page.getByRole("dialog")).toBeVisible();

		await page.getByRole("button", { name: "Close" }).click();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	test("renders without close button when showCloseButton is false", async () => {
		await render(
			<Sheet defaultOpen>
				<SheetContent showCloseButton={false}>
					<SheetHeader>
						<SheetTitle>No Close</SheetTitle>
						<SheetDescription>Desc</SheetDescription>
					</SheetHeader>
				</SheetContent>
			</Sheet>,
		);

		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect
			.element(page.getByRole("button", { name: "Close" }))
			.not.toBeInTheDocument();
	});

	test("renders with right side by default", async () => {
		await render(
			<Sheet defaultOpen>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Right Sheet</SheetTitle>
						<SheetDescription>Desc</SheetDescription>
					</SheetHeader>
				</SheetContent>
			</Sheet>,
		);

		const content = page.getByRole("dialog");
		await expect.element(content).toBeVisible();
	});

	test("renders header and footer", async () => {
		await render(
			<Sheet defaultOpen>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>My Sheet Title</SheetTitle>
						<SheetDescription>Sheet description text</SheetDescription>
					</SheetHeader>
					<SheetFooter>Footer content</SheetFooter>
				</SheetContent>
			</Sheet>,
		);

		await expect.element(page.getByText("My Sheet Title")).toBeVisible();
		await expect.element(page.getByText("Footer content")).toBeVisible();
	});

	test("SheetClose inside content closes sheet", async () => {
		await render(
			<Sheet defaultOpen>
				<SheetContent showCloseButton={false}>
					<SheetHeader>
						<SheetTitle>Title</SheetTitle>
						<SheetDescription>Desc</SheetDescription>
					</SheetHeader>
					<SheetClose>Custom Close</SheetClose>
				</SheetContent>
			</Sheet>,
		);

		await expect.element(page.getByRole("dialog")).toBeVisible();
		await page.getByText("Custom Close").click();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});
});
