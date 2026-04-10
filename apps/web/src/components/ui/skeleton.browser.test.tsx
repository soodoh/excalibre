import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
	test("renders with data-slot attribute", async () => {
		const screen = await render(<Skeleton data-testid="skel" />);
		const skeleton = screen.getByTestId("skel");
		await expect.element(skeleton).toHaveAttribute("data-slot", "skeleton");
	});

	test("has animate-pulse class", async () => {
		const screen = await render(<Skeleton data-testid="skel" />);
		const skeleton = screen.getByTestId("skel");
		await expect.element(skeleton).toHaveClass("animate-pulse");
	});

	test("applies custom className", async () => {
		const screen = await render(
			<Skeleton className="h-4 w-32" data-testid="skel" />,
		);
		const skeleton = screen.getByTestId("skel");
		await expect.element(skeleton).toHaveClass("h-4");
		await expect.element(skeleton).toHaveClass("w-32");
	});

	test("renders as a div element", async () => {
		const screen = await render(<Skeleton data-testid="skel" />);
		const skeleton = screen.getByTestId("skel");
		expect(skeleton.element().tagName).toBe("DIV");
	});
});
