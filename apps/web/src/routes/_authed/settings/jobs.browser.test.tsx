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

	test("renders jobs of all types and statuses with various timestamps", async () => {
		const now = Date.now();
		mocks.useQuery.mockReturnValue({
			data: [
				{
					id: 1,
					type: "convert",
					status: "running",
					payload: { sourceFormat: "epub", targetFormat: "mobi" },
					result: null,
					error: null,
					priority: 0,
					attempts: 1,
					maxAttempts: 3,
					scheduledAt: null,
					startedAt: new Date(now - 30 * 1000),
					completedAt: null,
					createdAt: new Date(now - 5 * 60 * 1000),
				},
				{
					id: 2,
					type: "convert",
					status: "pending",
					payload: { sourceFormat: 5, targetFormat: 10 },
					result: null,
					error: null,
					priority: 0,
					attempts: 0,
					maxAttempts: 3,
					scheduledAt: null,
					startedAt: null,
					completedAt: null,
					createdAt: new Date(now - 30 * 1000),
				},
				{
					id: 3,
					type: "epub_fix",
					status: "failed",
					payload: { fileId: 1 },
					result: null,
					error: "oh no something broke very badly on this system",
					priority: 0,
					attempts: 3,
					maxAttempts: 3,
					scheduledAt: null,
					startedAt: new Date(now - 60 * 60 * 1000),
					completedAt: new Date(now - 59 * 60 * 1000),
					createdAt: new Date(now - 60 * 60 * 1000),
				},
				{
					id: 4,
					type: "scan",
					status: "completed",
					payload: {},
					result: null,
					error: null,
					priority: 0,
					attempts: 1,
					maxAttempts: 3,
					scheduledAt: null,
					startedAt: new Date(now - 24 * 60 * 60 * 1000),
					completedAt: new Date(now - 24 * 60 * 60 * 1000 + 1000),
					createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
				},
				{
					id: 5,
					type: "scan",
					status: "pending",
					payload: null,
					result: null,
					error: null,
					priority: 0,
					attempts: 0,
					maxAttempts: 3,
					scheduledAt: null,
					startedAt: null,
					completedAt: null,
					createdAt: new Date(now - 60 * 1000),
				},
			],
			isLoading: false,
		});
		const Page = mocks.getComponent() as ComponentType;
		const screen = await render(<Page />);
		await expect.element(screen.getByText("running")).toBeVisible();
		await expect.element(screen.getByText("failed")).toBeVisible();
		await expect.element(screen.getByText("Fix EPUB")).toBeVisible();
	});
});
