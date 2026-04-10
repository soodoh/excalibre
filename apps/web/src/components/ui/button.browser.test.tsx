import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Button } from "./button";

describe("Button", () => {
	test("renders with text content", async () => {
		const screen = await render(<Button>Click me</Button>);
		await expect.element(screen.getByRole("button")).toBeVisible();
		await expect.element(screen.getByText("Click me")).toBeVisible();
	});

	describe("variants", () => {
		const variants = [
			"default",
			"destructive",
			"outline",
			"secondary",
			"ghost",
			"link",
		] as const;

		for (const variant of variants) {
			test(`renders ${variant} variant`, async () => {
				const screen = await render(
					<Button variant={variant}>{variant}</Button>,
				);
				const button = screen.getByRole("button");
				await expect.element(button).toBeVisible();
				await expect.element(button).toHaveAttribute("data-variant", variant);
			});
		}
	});

	describe("sizes", () => {
		const sizes = [
			"default",
			"xs",
			"sm",
			"lg",
			"icon",
			"icon-xs",
			"icon-sm",
			"icon-lg",
		] as const;

		for (const size of sizes) {
			test(`renders ${size} size`, async () => {
				const screen = await render(<Button size={size}>btn</Button>);
				const button = screen.getByRole("button");
				await expect.element(button).toBeVisible();
				await expect.element(button).toHaveAttribute("data-size", size);
			});
		}
	});

	test("fires click handler", async () => {
		const onClick = vi.fn();
		const screen = await render(<Button onClick={onClick}>Press</Button>);
		await screen.getByRole("button").click();
		expect(onClick).toHaveBeenCalledOnce();
	});

	test("disabled state prevents interaction", async () => {
		const onClick = vi.fn();
		const screen = await render(
			<Button disabled onClick={onClick}>
				Disabled
			</Button>,
		);
		const button = screen.getByRole("button");
		await expect.element(button).toBeDisabled();
	});

	test("asChild renders as child element", async () => {
		const screen = await render(
			<Button asChild>
				<a href="/test">Link button</a>
			</Button>,
		);
		const link = screen.getByRole("link");
		await expect.element(link).toBeVisible();
		await expect.element(link).toHaveAttribute("href", "/test");
		await expect.element(link).toHaveAttribute("data-slot", "button");
	});
});
