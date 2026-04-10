import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import type { FilterRules } from "./smart-filter-builder";
import { SmartFilterBuilder } from "./smart-filter-builder";

const DEFAULT_VALUE: FilterRules = {
	operator: "and",
	conditions: [],
};

describe("SmartFilterBuilder", () => {
	test("renders with match operator toggle", async () => {
		const screen = await render(
			<SmartFilterBuilder value={DEFAULT_VALUE} onChange={vi.fn()} />,
		);
		await expect.element(screen.getByText("Match")).toBeVisible();
		await expect.element(screen.getByText("All")).toBeVisible();
		await expect.element(screen.getByText("Any")).toBeVisible();
		await expect.element(screen.getByText("of the conditions")).toBeVisible();
	});

	test("renders add condition button", async () => {
		const screen = await render(
			<SmartFilterBuilder value={DEFAULT_VALUE} onChange={vi.fn()} />,
		);
		await expect
			.element(screen.getByRole("button", { name: /Add Condition/i }))
			.toBeVisible();
	});

	test("calls onChange when add condition is clicked", async () => {
		const onChange = vi.fn();
		const screen = await render(
			<SmartFilterBuilder value={DEFAULT_VALUE} onChange={onChange} />,
		);

		await screen.getByRole("button", { name: /Add Condition/i }).click();
		expect(onChange).toHaveBeenCalledOnce();
		const calledWith = onChange.mock.calls[0][0] as FilterRules;
		expect(calledWith.conditions).toHaveLength(1);
		expect(calledWith.conditions[0].field).toBe("title");
	});

	test("renders existing conditions", async () => {
		const value: FilterRules = {
			operator: "and",
			conditions: [
				{ field: "title", op: "contains", value: "fantasy" },
				{ field: "author", op: "equals", value: "Tolkien" },
			],
		};

		const screen = await render(
			<SmartFilterBuilder value={value} onChange={vi.fn()} />,
		);

		// Should have two remove buttons (one per condition)
		const removeButtons = screen
			.getByRole("button", { name: "Remove condition" })
			.all();
		expect(removeButtons).toHaveLength(2);
	});

	test("calls onChange when operator toggle is clicked", async () => {
		const onChange = vi.fn();
		const screen = await render(
			<SmartFilterBuilder value={DEFAULT_VALUE} onChange={onChange} />,
		);

		await screen.getByText("Any").click();
		expect(onChange).toHaveBeenCalledWith({
			operator: "or",
			conditions: [],
		});
	});

	test("calls onChange when remove condition is clicked", async () => {
		const onChange = vi.fn();
		const value: FilterRules = {
			operator: "and",
			conditions: [{ field: "title", op: "contains", value: "test" }],
		};

		const screen = await render(
			<SmartFilterBuilder value={value} onChange={onChange} />,
		);

		await screen.getByRole("button", { name: "Remove condition" }).click();
		expect(onChange).toHaveBeenCalledOnce();
		const calledWith = onChange.mock.calls[0][0] as FilterRules;
		expect(calledWith.conditions).toHaveLength(0);
	});

	test("renders value input for conditions", async () => {
		const value: FilterRules = {
			operator: "and",
			conditions: [{ field: "title", op: "contains", value: "fantasy" }],
		};

		const screen = await render(
			<SmartFilterBuilder value={value} onChange={vi.fn()} />,
		);

		// The text input should show the current value
		// vitest-browser-react doesn't have getByDisplayValue, so query by role
		const inputs = screen.getByRole("textbox").all();
		const valueInput = inputs[0];
		await expect.element(valueInput).toHaveValue("fantasy");
	});

	test("calls onChange when value input changes", async () => {
		const onChange = vi.fn();
		const value: FilterRules = {
			operator: "and",
			conditions: [{ field: "title", op: "contains", value: "" }],
		};

		const screen = await render(
			<SmartFilterBuilder value={value} onChange={onChange} />,
		);

		const input = screen.getByPlaceholder("Value\u2026");
		await userEvent.type(input, "s");
		expect(onChange).toHaveBeenCalled();
	});
});
