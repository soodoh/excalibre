import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./tooltip";

describe("Tooltip", () => {
	test("renders trigger element", async () => {
		const screen = await render(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>Tooltip text</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);
		await expect.element(screen.getByText("Hover me")).toBeVisible();
	});

	test("shows tooltip on hover", async () => {
		const screen = await render(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>Tooltip text</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);

		await userEvent.hover(screen.getByText("Hover me"));
		// Tooltip content renders in a portal
		await expect.element(page.getByRole("tooltip")).toBeVisible();
		await expect.element(page.getByText("Tooltip text")).toBeVisible();
	});

	test("hides tooltip when not hovering", async () => {
		await render(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>Tooltip text</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);

		// Tooltip should not be visible initially
		await expect.element(page.getByRole("tooltip")).not.toBeInTheDocument();
	});

	test("shows tooltip on focus", async () => {
		await render(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button type="button">Focus me</button>
					</TooltipTrigger>
					<TooltipContent>Focus tooltip</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);

		await userEvent.tab();
		await expect.element(page.getByRole("tooltip")).toBeVisible();
		await expect.element(page.getByText("Focus tooltip")).toBeVisible();
	});
});
