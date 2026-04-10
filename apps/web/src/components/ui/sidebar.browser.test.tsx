import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("src/hooks/use-mobile", () => ({
	useIsMobile: useIsMobileMock,
}));

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
} from "./sidebar";

describe("Sidebar", () => {
	test("renders sidebar provider and sidebar", async () => {
		const screen = await render(
			<SidebarProvider>
				<Sidebar>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>Menu</SidebarGroupLabel>
							<SidebarGroupContent>Content here</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
				</Sidebar>
			</SidebarProvider>,
		);

		await expect.element(screen.getByText("Menu")).toBeVisible();
		await expect.element(screen.getByText("Content here")).toBeVisible();
	});

	test("renders sidebar wrapper with data-slot", async () => {
		const screen = await render(
			<SidebarProvider>
				<Sidebar>
					<SidebarContent>Content</SidebarContent>
				</Sidebar>
			</SidebarProvider>,
		);

		const wrapper = screen.container.querySelector(
			'[data-slot="sidebar-wrapper"]',
		);
		expect(wrapper).toBeTruthy();
	});

	test("renders with expanded state by default", async () => {
		const screen = await render(
			<SidebarProvider>
				<Sidebar>
					<SidebarContent>Content</SidebarContent>
				</Sidebar>
			</SidebarProvider>,
		);

		const sidebar = screen.container.querySelector('[data-slot="sidebar"]');
		expect(sidebar).toBeTruthy();
		expect(sidebar?.getAttribute("data-state")).toBe("expanded");
	});

	test("renders with collapsed state when defaultOpen is false", async () => {
		const screen = await render(
			<SidebarProvider defaultOpen={false}>
				<Sidebar>
					<SidebarContent>Content</SidebarContent>
				</Sidebar>
			</SidebarProvider>,
		);

		const sidebar = screen.container.querySelector('[data-slot="sidebar"]');
		expect(sidebar).toBeTruthy();
		expect(sidebar?.getAttribute("data-state")).toBe("collapsed");
	});

	test("renders header and footer", async () => {
		const screen = await render(
			<SidebarProvider>
				<Sidebar>
					<SidebarHeader>Header content</SidebarHeader>
					<SidebarContent>Main content</SidebarContent>
					<SidebarFooter>Footer content</SidebarFooter>
				</Sidebar>
			</SidebarProvider>,
		);

		await expect.element(screen.getByText("Header content")).toBeVisible();
		await expect.element(screen.getByText("Main content")).toBeVisible();
		await expect.element(screen.getByText("Footer content")).toBeVisible();
	});

	test("renders menu items", async () => {
		const screen = await render(
			<SidebarProvider>
				<Sidebar>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton>Dashboard</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton>Settings</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
				</Sidebar>
			</SidebarProvider>,
		);

		await expect.element(screen.getByText("Dashboard")).toBeVisible();
		await expect.element(screen.getByText("Settings")).toBeVisible();
	});

	test("SidebarMenuButton renders active state", async () => {
		const screen = await render(
			<SidebarProvider>
				<Sidebar>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton isActive>Active Item</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
				</Sidebar>
			</SidebarProvider>,
		);

		const button = screen.getByText("Active Item");
		await expect.element(button).toHaveAttribute("data-active", "true");
	});

	test("SidebarTrigger toggles sidebar", async () => {
		const screen = await render(
			<SidebarProvider>
				<Sidebar>
					<SidebarContent>Content</SidebarContent>
				</Sidebar>
				<SidebarInset>
					<SidebarTrigger />
				</SidebarInset>
			</SidebarProvider>,
		);

		const sidebar = screen.container.querySelector('[data-slot="sidebar"]');
		expect(sidebar?.getAttribute("data-state")).toBe("expanded");

		await screen.getByRole("button", { name: "Toggle Sidebar" }).click();

		expect(sidebar?.getAttribute("data-state")).toBe("collapsed");
	});

	test("renders separator", async () => {
		const screen = await render(
			<SidebarProvider>
				<Sidebar>
					<SidebarContent>
						<SidebarSeparator data-testid="sep" />
					</SidebarContent>
				</Sidebar>
			</SidebarProvider>,
		);

		const separator = screen.getByTestId("sep");
		await expect
			.element(separator)
			.toHaveAttribute("data-slot", "sidebar-separator");
	});

	test("renders collapsible=none variant without toggle behavior", async () => {
		const screen = await render(
			<SidebarProvider>
				<Sidebar collapsible="none">
					<SidebarContent>Static sidebar</SidebarContent>
				</Sidebar>
			</SidebarProvider>,
		);

		await expect.element(screen.getByText("Static sidebar")).toBeVisible();
	});
});
