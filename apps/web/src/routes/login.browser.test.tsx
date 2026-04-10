import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		signIn: { email: vi.fn() },
		navigate: vi.fn(),
		toastError: vi.fn(),
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
	useNavigate: () => mocks.navigate,
}));

vi.mock("src/lib/auth-client", () => ({
	signIn: mocks.signIn,
}));

vi.mock("sonner", () => ({
	toast: {
		error: mocks.toastError,
		success: vi.fn(),
	},
}));

// Import the route file to capture the component
import "./login";

type ComponentType = () => React.JSX.Element;

describe("LoginPage", () => {
	test("renders the login card title", async () => {
		const LoginPage = mocks.getComponent() as ComponentType;
		const screen = await render(<LoginPage />);
		await expect.element(screen.getByText("Excalibre")).toBeVisible();
	});

	test("renders sign in description", async () => {
		const LoginPage = mocks.getComponent() as ComponentType;
		const screen = await render(<LoginPage />);
		await expect
			.element(screen.getByText("Sign in to your account"))
			.toBeVisible();
	});

	test("renders email and password inputs", async () => {
		const LoginPage = mocks.getComponent() as ComponentType;
		const screen = await render(<LoginPage />);
		await expect.element(screen.getByLabelText("Email")).toBeVisible();
		await expect.element(screen.getByLabelText("Password")).toBeVisible();
	});

	test("renders sign in button", async () => {
		const LoginPage = mocks.getComponent() as ComponentType;
		const screen = await render(<LoginPage />);
		await expect
			.element(screen.getByRole("button", { name: "Sign In" }))
			.toBeVisible();
	});

	test("renders register link", async () => {
		const LoginPage = mocks.getComponent() as ComponentType;
		const screen = await render(<LoginPage />);
		await expect
			.element(screen.getByRole("link", { name: "Register" }))
			.toBeVisible();
	});
});
