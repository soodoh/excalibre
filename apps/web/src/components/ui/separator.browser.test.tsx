import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { Separator } from "./separator";

describe("Separator", () => {
	test("renders with data-slot attribute", async () => {
		const screen = await render(<Separator data-testid="sep" />);
		const separator = screen.getByTestId("sep");
		await expect.element(separator).toHaveAttribute("data-slot", "separator");
	});

	test("renders horizontal orientation by default", async () => {
		const screen = await render(<Separator data-testid="sep" />);
		const separator = screen.getByTestId("sep");
		await expect
			.element(separator)
			.toHaveAttribute("data-orientation", "horizontal");
	});

	test("renders vertical orientation", async () => {
		const screen = await render(
			<Separator orientation="vertical" data-testid="sep" />,
		);
		const separator = screen.getByTestId("sep");
		await expect
			.element(separator)
			.toHaveAttribute("data-orientation", "vertical");
	});

	test("is decorative by default (role=none)", async () => {
		const screen = await render(<Separator data-testid="sep" />);
		const separator = screen.getByTestId("sep");
		await expect.element(separator).toHaveRole("none");
	});

	test("renders as separator role when not decorative", async () => {
		const screen = await render(
			<Separator decorative={false} data-testid="sep" />,
		);
		const separator = screen.getByRole("separator");
		await expect.element(separator).toBeInTheDocument();
	});

	test("applies custom className", async () => {
		const screen = await render(
			<Separator className="custom-sep" data-testid="sep" />,
		);
		const separator = screen.getByTestId("sep");
		await expect.element(separator).toHaveClass("custom-sep");
	});
});
