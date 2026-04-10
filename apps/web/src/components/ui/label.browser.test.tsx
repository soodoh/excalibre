import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { Label } from "./label";

describe("Label", () => {
	test("renders with text content", async () => {
		const screen = await render(<Label>Username</Label>);
		await expect.element(screen.getByText("Username")).toBeVisible();
	});

	test("renders with data-slot attribute", async () => {
		const screen = await render(<Label>Email</Label>);
		const label = screen.getByText("Email");
		await expect.element(label).toHaveAttribute("data-slot", "label");
	});

	test("renders as a label element", async () => {
		const screen = await render(<Label>Name</Label>);
		const label = screen.getByText("Name");
		expect(label.element().tagName).toBe("LABEL");
	});

	test("associates with input via htmlFor", async () => {
		const screen = await render(
			<div>
				<Label htmlFor="test-input">Test Label</Label>
				<input id="test-input" type="text" />
			</div>,
		);
		const label = screen.getByText("Test Label");
		await expect.element(label).toHaveAttribute("for", "test-input");
	});

	test("applies custom className", async () => {
		const screen = await render(<Label className="custom-label">Custom</Label>);
		const label = screen.getByText("Custom");
		await expect.element(label).toHaveClass("custom-label");
	});
});
