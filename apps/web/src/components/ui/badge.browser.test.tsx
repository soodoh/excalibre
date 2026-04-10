import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { Badge } from "./badge";

describe("Badge", () => {
	test("renders with text content", async () => {
		const screen = await render(<Badge>New</Badge>);
		await expect.element(screen.getByText("New")).toBeVisible();
	});

	test("renders with data-slot attribute", async () => {
		const screen = await render(<Badge>Tag</Badge>);
		const badge = screen.getByText("Tag");
		await expect.element(badge).toHaveAttribute("data-slot", "badge");
	});

	describe("variants", () => {
		const variants = [
			"default",
			"secondary",
			"destructive",
			"outline",
			"ghost",
			"link",
		] as const;

		for (const variant of variants) {
			test(`renders ${variant} variant`, async () => {
				const screen = await render(<Badge variant={variant}>{variant}</Badge>);
				const badge = screen.getByText(variant);
				await expect.element(badge).toBeVisible();
				await expect.element(badge).toHaveAttribute("data-variant", variant);
			});
		}
	});

	test("applies custom className", async () => {
		const screen = await render(<Badge className="custom-class">Styled</Badge>);
		const badge = screen.getByText("Styled");
		await expect.element(badge).toHaveClass("custom-class");
	});

	test("renders as span by default", async () => {
		const screen = await render(<Badge>Default</Badge>);
		const badge = screen.getByText("Default");
		await expect.element(badge).toBeVisible();
		// Badge uses a <span> element by default
		expect(badge.element().tagName).toBe("SPAN");
	});

	test("asChild renders as child element", async () => {
		const screen = await render(
			<Badge asChild>
				<a href="/test">Link badge</a>
			</Badge>,
		);
		const link = screen.getByRole("link");
		await expect.element(link).toBeVisible();
		await expect.element(link).toHaveAttribute("href", "/test");
		await expect.element(link).toHaveAttribute("data-slot", "badge");
	});
});
