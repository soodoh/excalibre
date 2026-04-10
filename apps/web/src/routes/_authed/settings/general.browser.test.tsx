import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		setComponent: (c: unknown) => {
			captured = c;
		},
		getComponent: () => captured,
	};
});

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (fn: unknown) => fn,
		inputValidator: () => ({ handler: (fn: unknown) => fn }),
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (opts: { component: unknown }) => {
		mocks.setComponent(opts.component);
		return { component: opts.component };
	},
	redirect: vi.fn(),
}));

vi.mock("src/server/middleware", () => ({
	getAuthSessionFn: vi.fn(),
}));

import "./general";

type ComponentType = () => React.JSX.Element;

describe("GeneralSettingsPage", () => {
	test("renders title and description", async () => {
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "General Settings" }))
			.toBeVisible();
		await expect
			.element(
				screen.getByText("Server configuration and authentication status."),
			)
			.toBeVisible();
	});
});
