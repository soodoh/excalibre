import { toast } from "sonner";
import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

vi.mock("next-themes", () => ({
	useTheme: () => ({ theme: "dark" }),
}));

import { Toaster } from "./sonner";

describe("Toaster", () => {
	test("renders toaster container", async () => {
		await render(<Toaster />);
		// Sonner renders a <section> with aria-label="Notifications ..."
		await expect
			.element(page.getByRole("region", { name: /Notifications/ }))
			.toBeInTheDocument();
	});

	test("shows a toast notification", async () => {
		await render(<Toaster />);

		toast("Test notification");

		await expect.element(page.getByText("Test notification")).toBeVisible();
	});

	test("shows a success toast", async () => {
		await render(<Toaster />);

		toast.success("Operation succeeded");

		await expect.element(page.getByText("Operation succeeded")).toBeVisible();
	});

	test("shows an error toast", async () => {
		await render(<Toaster />);

		toast.error("Something went wrong");

		await expect.element(page.getByText("Something went wrong")).toBeVisible();
	});

	test("shows multiple toasts", async () => {
		await render(<Toaster />);

		toast("First toast");
		toast("Second toast");

		await expect.element(page.getByText("First toast")).toBeVisible();
		await expect.element(page.getByText("Second toast")).toBeVisible();
	});
});
