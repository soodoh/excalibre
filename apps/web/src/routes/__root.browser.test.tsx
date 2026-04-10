import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	let capturedOpts: {
		head?: () => unknown;
		component?: unknown;
	} | null = null;
	return {
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
	createRootRouteWithContext:
		() => (opts: { component: unknown; head?: () => unknown }) => {
			mocks.setComponent(opts.component);
			mocks.setOpts(opts);
			return { component: opts.component };
		},
	HeadContent: () => null,
	Outlet: () => <div data-testid="outlet">Outlet</div>,
	Scripts: () => null,
}));

vi.mock("src/components/ui/sonner", () => ({
	Toaster: () => <div data-testid="toaster" />,
}));

vi.mock("src/styles/app.css?url", () => ({ default: "/app.css" }));

import { Route } from "./__root";

describe("__root Route", () => {
	test("exports a Route with a component", () => {
		expect(Route).toBeDefined();
		expect(Route.component).toBeTypeOf("function");
	});

	test("captured RootComponent renders without throwing", () => {
		const RootComponent = mocks.getComponent() as () => React.ReactNode;
		expect(RootComponent).toBeTypeOf("function");
		// Do not render — it creates an <html> element which cannot be placed
		// inside a test document body.
		expect(() => RootComponent()).not.toThrow();
	});

	test("head function returns meta and link entries", () => {
		const opts = mocks.getOpts();
		const result = opts?.head?.() as
			| {
					meta: Array<Record<string, string>>;
					links: Array<Record<string, string>>;
			  }
			| undefined;
		expect(result?.meta).toBeDefined();
		expect(result?.links).toBeDefined();
		expect(result?.meta?.some((m) => m.title === "Excalibre")).toBe(true);
	});
});
