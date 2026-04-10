import { useForm } from "react-hook-form";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "./form";
import { Input } from "./input";

function TestForm({
	onSubmit,
	defaultValues,
}: {
	onSubmit?: (data: { username: string }) => void;
	defaultValues?: { username: string };
}) {
	const form = useForm({
		defaultValues: defaultValues ?? { username: "" },
	});

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit ?? (() => {}))}>
				<FormField
					control={form.control}
					name="username"
					rules={{ required: "Username is required" }}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Username</FormLabel>
							<FormControl>
								<Input placeholder="Enter username" {...field} />
							</FormControl>
							<FormDescription>Your public display name.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<button type="submit">Submit</button>
			</form>
		</Form>
	);
}

describe("Form", () => {
	test("renders form with label, input, and description", async () => {
		const screen = await render(<TestForm />);

		await expect.element(screen.getByText("Username")).toBeVisible();
		await expect
			.element(screen.getByPlaceholder("Enter username"))
			.toBeVisible();
		await expect
			.element(screen.getByText("Your public display name."))
			.toBeVisible();
	});

	test("label has correct data-slot", async () => {
		const screen = await render(<TestForm />);
		const label = screen.getByText("Username");
		await expect.element(label).toHaveAttribute("data-slot", "form-label");
	});

	test("description has correct data-slot", async () => {
		const screen = await render(<TestForm />);
		const desc = screen.getByText("Your public display name.");
		await expect.element(desc).toHaveAttribute("data-slot", "form-description");
	});

	test("label is associated with input via htmlFor", async () => {
		const screen = await render(<TestForm />);
		const label = screen.getByText("Username");
		const input = screen.getByPlaceholder("Enter username");

		// The label's htmlFor should match the input's id
		const inputId = input.element().getAttribute("id");
		await expect.element(label).toHaveAttribute("for", inputId!);
	});

	test("input has aria-describedby linking to description", async () => {
		const screen = await render(<TestForm />);
		const input = screen.getByPlaceholder("Enter username");
		const ariaDescribedBy = input.element().getAttribute("aria-describedby");
		expect(ariaDescribedBy).toBeTruthy();
	});

	test("shows validation error message on submit with empty field", async () => {
		const screen = await render(<TestForm />);

		await screen.getByRole("button", { name: "Submit" }).click();

		await expect
			.element(screen.getByText("Username is required"))
			.toBeVisible();
	});

	test("error message has correct data-slot", async () => {
		const screen = await render(<TestForm />);

		await screen.getByRole("button", { name: "Submit" }).click();

		const errorMsg = screen.getByText("Username is required");
		await expect.element(errorMsg).toHaveAttribute("data-slot", "form-message");
	});

	test("input becomes aria-invalid on validation error", async () => {
		const screen = await render(<TestForm />);

		await screen.getByRole("button", { name: "Submit" }).click();

		const input = screen.getByPlaceholder("Enter username");
		await expect.element(input).toHaveAttribute("aria-invalid", "true");
	});

	test("accepts user input in form field", async () => {
		const screen = await render(<TestForm />);
		const input = screen.getByPlaceholder("Enter username");

		await userEvent.type(input, "johndoe");
		await expect.element(input).toHaveValue("johndoe");
	});
});
