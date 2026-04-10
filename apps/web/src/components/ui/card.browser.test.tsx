import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./card";

describe("Card", () => {
	test("renders basic card", async () => {
		const screen = await render(<Card>Card content</Card>);
		await expect.element(screen.getByText("Card content")).toBeVisible();
	});

	test("renders with data-slot attribute", async () => {
		const screen = await render(<Card>Content</Card>);
		const card = screen.getByText("Content");
		await expect.element(card).toHaveAttribute("data-slot", "card");
	});

	test("renders full card composition", async () => {
		const screen = await render(
			<Card>
				<CardHeader>
					<CardTitle>Title</CardTitle>
					<CardDescription>Description</CardDescription>
					<CardAction>Action</CardAction>
				</CardHeader>
				<CardContent>Body content</CardContent>
				<CardFooter>Footer content</CardFooter>
			</Card>,
		);

		await expect.element(screen.getByText("Title")).toBeVisible();
		await expect.element(screen.getByText("Description")).toBeVisible();
		await expect.element(screen.getByText("Action")).toBeVisible();
		await expect.element(screen.getByText("Body content")).toBeVisible();
		await expect.element(screen.getByText("Footer content")).toBeVisible();
	});

	test("each sub-component has correct data-slot", async () => {
		const screen = await render(
			<Card>
				<CardHeader>
					<CardTitle>Title</CardTitle>
					<CardDescription>Desc</CardDescription>
					<CardAction>Act</CardAction>
				</CardHeader>
				<CardContent>Body</CardContent>
				<CardFooter>Foot</CardFooter>
			</Card>,
		);

		await expect
			.element(screen.getByText("Title"))
			.toHaveAttribute("data-slot", "card-title");
		await expect
			.element(screen.getByText("Desc"))
			.toHaveAttribute("data-slot", "card-description");
		await expect
			.element(screen.getByText("Act"))
			.toHaveAttribute("data-slot", "card-action");
		await expect
			.element(screen.getByText("Body"))
			.toHaveAttribute("data-slot", "card-content");
		await expect
			.element(screen.getByText("Foot"))
			.toHaveAttribute("data-slot", "card-footer");
	});

	test("applies custom className to card", async () => {
		const screen = await render(<Card className="custom-card">Styled</Card>);
		const card = screen.getByText("Styled");
		await expect.element(card).toHaveClass("custom-card");
	});
});
