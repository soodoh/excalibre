import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => {
	let captured: unknown = null;
	return {
		useQuery: vi.fn(),
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

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("src/server/conversion", () => ({
	getRecentJobsFn: vi.fn(),
}));

vi.mock("src/server/middleware", () => ({
	getAuthSessionFn: vi.fn(),
}));

import "./jobs";

type ComponentType = () => React.JSX.Element;

describe("JobsSettingsPage", () => {
	test("renders title and description", async () => {
		mocks.useQuery.mockReturnValue({ data: [], isLoading: false });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect
			.element(screen.getByRole("heading", { name: "Jobs" }))
			.toBeVisible();
		await expect
			.element(screen.getByText("Monitor background job queue."))
			.toBeVisible();
	});

	test("shows loading state", async () => {
		mocks.useQuery.mockReturnValue({ data: undefined, isLoading: true });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("Loading jobs...")).toBeVisible();
	});

	test("shows no jobs state", async () => {
		mocks.useQuery.mockReturnValue({ data: [], isLoading: false });
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("No jobs yet")).toBeVisible();
	});

	test("renders jobs table with data", async () => {
		mocks.useQuery.mockReturnValue({
			data: [
				{
					id: 1,
					type: "scan",
					status: "completed",
					payload: { libraryId: 1 },
					result: null,
					error: null,
					priority: 0,
					attempts: 1,
					maxAttempts: 3,
					scheduledAt: null,
					startedAt: new Date(Date.now() - 60000),
					completedAt: new Date(),
					createdAt: new Date(Date.now() - 120000),
				},
			],
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("completed")).toBeVisible();
		await expect.element(screen.getByText("Library scan")).toBeVisible();
	});
});
