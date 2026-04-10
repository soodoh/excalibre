import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { Input } from "./input";

describe("Input", () => {
	test("renders with data-slot attribute", async () => {
		const screen = await render(<Input />);
		const input = screen.getByRole("textbox");
		await expect.element(input).toHaveAttribute("data-slot", "input");
	});

	test("renders text input by default", async () => {
		const screen = await render(<Input />);
		const input = screen.getByRole("textbox");
		await expect.element(input).toBeVisible();
	});

	test("renders with placeholder", async () => {
		const screen = await render(<Input placeholder="Enter text..." />);
		const input = screen.getByPlaceholder("Enter text...");
		await expect.element(input).toBeVisible();
	});

	test("accepts user input", async () => {
		const screen = await render(<Input />);
		const input = screen.getByRole("textbox");
		await userEvent.type(input, "Hello world");
		await expect.element(input).toHaveValue("Hello world");
	});

	test("fires onChange handler", async () => {
		const onChange = vi.fn();
		const screen = await render(<Input onChange={onChange} />);
		const input = screen.getByRole("textbox");
		await userEvent.type(input, "a");
		expect(onChange).toHaveBeenCalled();
	});

	test("disabled state prevents interaction", async () => {
		const screen = await render(<Input disabled />);
		const input = screen.getByRole("textbox");
		await expect.element(input).toBeDisabled();
	});

	test("renders with specific type", async () => {
		const screen = await render(
			<Input type="password" data-testid="pw-input" />,
		);
		const input = screen.getByTestId("pw-input");
		await expect.element(input).toHaveAttribute("type", "password");
	});

	test("applies custom className", async () => {
		const screen = await render(<Input className="custom-input" />);
		const input = screen.getByRole("textbox");
		await expect.element(input).toHaveClass("custom-input");
	});
});
