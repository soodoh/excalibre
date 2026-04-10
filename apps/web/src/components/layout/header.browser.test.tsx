import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("src/hooks/use-mobile", () => ({
	useIsMobile: useIsMobileMock,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		...rest
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => <a {...rest}>{children}</a>,
}));

import { SidebarProvider } from "src/components/ui/sidebar";
import Header from "./header";

function renderHeader() {
	return render(
		<SidebarProvider>
			<Header />
		</SidebarProvider>,
	);
}

describe("Header", () => {
	test("renders the header element", async () => {
		const screen = await renderHeader();
		const header = screen.container.querySelector("header");
		expect(header).toBeTruthy();
	});

	test("renders the search button", async () => {
		const screen = await renderHeader();
		await expect
			.element(screen.getByRole("button", { name: "Search" }))
			.toBeVisible();
	});

	test("renders sidebar trigger button", async () => {
		const screen = await renderHeader();
		await expect
			.element(screen.getByRole("button", { name: "Toggle Sidebar" }))
			.toBeVisible();
	});

	test("renders a separator", async () => {
		const screen = await renderHeader();
		const separator = screen.container.querySelector("[data-slot='separator']");
		expect(separator).toBeTruthy();
	});
});
