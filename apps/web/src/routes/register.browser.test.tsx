import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		signUp: { email: vi.fn() },
		navigate: vi.fn(),
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
	Link: ({
		children,
		to,
		...rest
	}: {
		children: React.ReactNode;
		to?: string;
		[k: string]: unknown;
	}) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
	redirect: vi.fn(),
	useNavigate: () => mocks.navigate,
}));

vi.mock("src/lib/auth-client", () => ({
	signUp: mocks.signUp,
}));

vi.mock("src/server/auth", () => ({
	getIsFirstUserFn: vi.fn(() => Promise.resolve({ isFirstUser: true })),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

import "./register";

type ComponentType = () => React.JSX.Element;

describe("RegisterPage", () => {
	test("renders the create account title", async () => {
		const RegisterPage = mocks.getComponent() as ComponentType;
		const screen = await render(<RegisterPage />);
		await expect.element(screen.getByText("Create Account")).toBeVisible();
	});

	test("renders admin setup description", async () => {
		const RegisterPage = mocks.getComponent() as ComponentType;
		const screen = await render(<RegisterPage />);
		await expect
			.element(
				screen.getByText("Set up your Excalibre admin account to get started."),
			)
			.toBeVisible();
	});

	test("renders name, email, and password inputs", async () => {
		const RegisterPage = mocks.getComponent() as ComponentType;
		const screen = await render(<RegisterPage />);
		await expect.element(screen.getByLabelText("Name")).toBeVisible();
		await expect.element(screen.getByLabelText("Email")).toBeVisible();
		await expect.element(screen.getByLabelText("Password")).toBeVisible();
	});

	test("renders register button", async () => {
		const RegisterPage = mocks.getComponent() as ComponentType;
		const screen = await render(<RegisterPage />);
		await expect
			.element(screen.getByRole("button", { name: "Register" }))
			.toBeVisible();
	});

	test("renders sign in link", async () => {
		const RegisterPage = mocks.getComponent() as ComponentType;
		const screen = await render(<RegisterPage />);
		await expect
			.element(screen.getByRole("link", { name: "Sign in" }))
			.toBeVisible();
	});
});
