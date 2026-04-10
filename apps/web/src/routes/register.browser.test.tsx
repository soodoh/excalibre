import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		signUp: { email: vi.fn() },
		navigate: vi.fn(),
		toastError: vi.fn(),
		toastSuccess: vi.fn(),
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
		error: mocks.toastError,
		success: mocks.toastSuccess,
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

	test("successful sign-up navigates to home", async () => {
		mocks.signUp.email.mockResolvedValue({ error: null });
		const RegisterPage = mocks.getComponent() as ComponentType;
		const screen = await render(<RegisterPage />);
		await screen.getByLabelText("Name").fill("Jane");
		await screen.getByLabelText("Email").fill("j@b.com");
		await screen.getByLabelText("Password").fill("password123");
		await screen.getByRole("button", { name: "Register" }).click();
		await new Promise((r) => setTimeout(r, 50));
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
		expect(mocks.toastSuccess).toHaveBeenCalled();
	});

	test("sign-up error shows toast", async () => {
		mocks.signUp.email.mockResolvedValue({
			error: { message: "Email taken" },
		});
		const RegisterPage = mocks.getComponent() as ComponentType;
		const screen = await render(<RegisterPage />);
		await screen.getByLabelText("Name").fill("Jane");
		await screen.getByLabelText("Email").fill("j@b.com");
		await screen.getByLabelText("Password").fill("password123");
		await screen.getByRole("button", { name: "Register" }).click();
		await new Promise((r) => setTimeout(r, 50));
		expect(mocks.toastError).toHaveBeenCalled();
	});

	test("sign-up error without message uses default", async () => {
		mocks.signUp.email.mockResolvedValue({ error: {} });
		const RegisterPage = mocks.getComponent() as ComponentType;
		const screen = await render(<RegisterPage />);
		await screen.getByLabelText("Name").fill("Jane");
		await screen.getByLabelText("Email").fill("j@b.com");
		await screen.getByLabelText("Password").fill("password123");
		await screen.getByRole("button", { name: "Register" }).click();
		await new Promise((r) => setTimeout(r, 50));
		expect(mocks.toastError).toHaveBeenCalled();
	});

	test("sign-up thrown exception shows toast", async () => {
		mocks.signUp.email.mockRejectedValue(new Error("Network error"));
		const RegisterPage = mocks.getComponent() as ComponentType;
		const screen = await render(<RegisterPage />);
		await screen.getByLabelText("Name").fill("Jane");
		await screen.getByLabelText("Email").fill("j@b.com");
		await screen.getByLabelText("Password").fill("password123");
		await screen.getByRole("button", { name: "Register" }).click();
		await new Promise((r) => setTimeout(r, 50));
		expect(mocks.toastError).toHaveBeenCalled();
	});
});
