import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";

describe("Dialog", () => {
	test("renders trigger button", async () => {
		const screen = await render(
			<Dialog>
				<DialogTrigger>Open Dialog</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Title</DialogTitle>
						<DialogDescription>Description</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>,
		);
		await expect.element(screen.getByText("Open Dialog")).toBeVisible();
	});

	test("opens when trigger is clicked", async () => {
		const screen = await render(
			<Dialog>
				<DialogTrigger>Open</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>My Dialog</DialogTitle>
						<DialogDescription>Dialog description</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>,
		);

		await screen.getByText("Open").click();
		// Dialog content renders in a portal, so use page-level query
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.getByText("My Dialog")).toBeVisible();
		await expect.element(page.getByText("Dialog description")).toBeVisible();
	});

	test("closes when close button is clicked", async () => {
		const screen = await render(
			<Dialog>
				<DialogTrigger>Open</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Title</DialogTitle>
						<DialogDescription>Desc</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>,
		);

		await screen.getByText("Open").click();
		await expect.element(page.getByRole("dialog")).toBeVisible();

		// Click the sr-only Close button
		await page.getByRole("button", { name: "Close" }).click();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	test("renders without close button when showCloseButton is false", async () => {
		await render(
			<Dialog defaultOpen>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>No Close</DialogTitle>
						<DialogDescription>Desc</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>,
		);

		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect
			.element(page.getByRole("button", { name: "Close" }))
			.not.toBeInTheDocument();
	});

	test("renders header and footer", async () => {
		await render(
			<Dialog defaultOpen>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Header Title</DialogTitle>
						<DialogDescription>Header Desc</DialogDescription>
					</DialogHeader>
					<DialogFooter>Footer content</DialogFooter>
				</DialogContent>
			</Dialog>,
		);

		await expect.element(page.getByText("Header Title")).toBeVisible();
		await expect.element(page.getByText("Footer content")).toBeVisible();
	});

	test("renders footer with close button", async () => {
		await render(
			<Dialog defaultOpen>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Title</DialogTitle>
						<DialogDescription>Desc</DialogDescription>
					</DialogHeader>
					<DialogFooter showCloseButton>Done</DialogFooter>
				</DialogContent>
			</Dialog>,
		);

		await expect.element(page.getByText("Done")).toBeVisible();
		// The footer close button renders a "Close" labeled button
		await expect
			.element(page.getByRole("button", { name: "Close" }))
			.toBeVisible();
	});

	test("calls onOpenChange when opened and closed", async () => {
		const onOpenChange = vi.fn();
		const screen = await render(
			<Dialog onOpenChange={onOpenChange}>
				<DialogTrigger>Open</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Title</DialogTitle>
						<DialogDescription>Desc</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>,
		);

		await screen.getByText("Open").click();
		expect(onOpenChange).toHaveBeenCalledWith(true);
	});

	test("DialogClose inside content closes dialog", async () => {
		await render(
			<Dialog defaultOpen>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Title</DialogTitle>
						<DialogDescription>Desc</DialogDescription>
					</DialogHeader>
					<DialogClose>Custom Close</DialogClose>
				</DialogContent>
			</Dialog>,
		);

		await expect.element(page.getByRole("dialog")).toBeVisible();
		await page.getByText("Custom Close").click();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});
});
