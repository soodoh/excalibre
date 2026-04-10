import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	let capturedOpts: {
		beforeLoad?: (...args: unknown[]) => unknown;
		component?: unknown;
	} | null = null;
	return {
		getAuthSessionFn: vi.fn(),
		redirect: vi.fn((arg: unknown) => {
			const err = new Error("REDIRECT");
			(err as unknown as { __redirect: unknown }).__redirect = arg;
			throw err;
		}),
		setComponent: (c: unknown) => {
			captured = c;
		},
		getComponent: () => captured,
		setOpts: (o: typeof capturedOpts) => {
			capturedOpts = o;
		},
		getOpts: () => capturedOpts,
	};
});

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (fn: unknown) => fn,
		inputValidator: () => ({ handler: (fn: unknown) => fn }),
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute:
		() =>
		(opts: {
			component: unknown;
			beforeLoad?: (...args: unknown[]) => unknown;
		}) => {
			mocks.setComponent(opts.component);
			mocks.setOpts(opts);
			return { component: opts.component };
		},
	redirect: mocks.redirect,
}));

vi.mock("src/server/middleware", () => ({
	getAuthSessionFn: mocks.getAuthSessionFn,
}));

import "./users";

type ComponentType = () => React.JSX.Element;

describe("UsersSettingsPage", () => {
	test("renders title and description", async () => {
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "Users" }))
			.toBeVisible();
		await expect
			.element(screen.getByText("Manage users and library access."))
			.toBeVisible();
	});

	test("beforeLoad allows admin session", async () => {
		mocks.getAuthSessionFn.mockResolvedValue({
			user: { role: "admin" },
		});
		const opts = mocks.getOpts();
		await opts?.beforeLoad?.();
		expect(mocks.redirect).not.toHaveBeenCalled();
	});

	test("beforeLoad redirects non-admin", async () => {
		mocks.getAuthSessionFn.mockResolvedValue({
			user: { role: "user" },
		});
		const opts = mocks.getOpts();
		await expect(async () => {
			await opts?.beforeLoad?.();
		}).rejects.toThrow();
	});

	test("beforeLoad redirects when no session", async () => {
		mocks.getAuthSessionFn.mockResolvedValue(null);
		const opts = mocks.getOpts();
		await expect(async () => {
			await opts?.beforeLoad?.();
		}).rejects.toThrow();
	});
});
