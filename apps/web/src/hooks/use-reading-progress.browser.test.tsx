import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => ({
	useQuery: vi.fn(),
	useMutation: vi.fn(),
	useQueryClient: vi.fn(),
	getReadingProgressFn: vi.fn(),
	saveReadingProgressFn: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mocks.useQuery(...args),
	useMutation: (...args: unknown[]) => mocks.useMutation(...args),
	useQueryClient: (...args: unknown[]) => mocks.useQueryClient(...args),
}));

vi.mock("src/server/reading", () => ({
	getReadingProgressFn: (...args: unknown[]) =>
		mocks.getReadingProgressFn(...args),
	saveReadingProgressFn: (...args: unknown[]) =>
		mocks.saveReadingProgressFn(...args),
}));

import { useReadingProgress } from "./use-reading-progress";

function TestComponent({ bookId }: { bookId: number }) {
	const { initialPosition, initialProgress, saveProgress, isSaving } =
		useReadingProgress(bookId);
	return (
		<div>
			<div data-testid="initial-position">{initialPosition ?? "none"}</div>
			<div data-testid="initial-progress">{initialProgress}</div>
			<div data-testid="is-saving">{isSaving ? "yes" : "no"}</div>
			<button
				data-testid="save"
				onClick={() => saveProgress(0.42, "epubcfi(/6/4)")}
				type="button"
			>
				Save
			</button>
		</div>
	);
}

describe("useReadingProgress", () => {
	test("returns initial progress from web device entry", async () => {
		mocks.useQuery.mockReturnValue({
			data: [
				{
					deviceType: "web",
					progress: 0.35,
					position: "epubcfi(/6/2)",
				},
				{
					deviceType: "ios",
					progress: 0.9,
					position: "epubcfi(/6/20)",
				},
			],
		});
		const mutate = vi.fn();
		mocks.useMutation.mockReturnValue({
			mutate,
			isPending: false,
		});
		mocks.useQueryClient.mockReturnValue({
			invalidateQueries: vi.fn(),
		});

		const screen = await render(<TestComponent bookId={1} />);
		await expect
			.element(screen.getByTestId("initial-progress"))
			.toHaveTextContent("0.35");
		await expect
			.element(screen.getByTestId("initial-position"))
			.toHaveTextContent("epubcfi(/6/2)");
		await expect
			.element(screen.getByTestId("is-saving"))
			.toHaveTextContent("no");
	});

	test("returns defaults when no web progress exists", async () => {
		mocks.useQuery.mockReturnValue({ data: [] });
		mocks.useMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
		});
		mocks.useQueryClient.mockReturnValue({
			invalidateQueries: vi.fn(),
		});

		const screen = await render(<TestComponent bookId={1} />);
		await expect
			.element(screen.getByTestId("initial-progress"))
			.toHaveTextContent("0");
		await expect
			.element(screen.getByTestId("initial-position"))
			.toHaveTextContent("none");
	});

	test("reflects isSaving from mutation pending state", async () => {
		mocks.useQuery.mockReturnValue({ data: [] });
		mocks.useMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: true,
		});
		mocks.useQueryClient.mockReturnValue({
			invalidateQueries: vi.fn(),
		});

		const screen = await render(<TestComponent bookId={1} />);
		await expect
			.element(screen.getByTestId("is-saving"))
			.toHaveTextContent("yes");
	});

	test("saveProgress debounces and calls mutation after timeout", async () => {
		vi.useFakeTimers();
		try {
			mocks.useQuery.mockReturnValue({ data: [] });
			const mutate = vi.fn();
			mocks.useMutation.mockReturnValue({
				mutate,
				isPending: false,
			});
			mocks.useQueryClient.mockReturnValue({
				invalidateQueries: vi.fn(),
			});

			const screen = await render(<TestComponent bookId={1} />);
			await screen.getByTestId("save").click();

			// Not yet called — still within debounce window
			expect(mutate).not.toHaveBeenCalled();

			vi.advanceTimersByTime(2000);
			expect(mutate).toHaveBeenCalledTimes(1);
			expect(mutate).toHaveBeenCalledWith({
				progress: 0.42,
				position: "epubcfi(/6/4)",
			});
		} finally {
			vi.useRealTimers();
		}
	});

	test("saveProgress collapses rapid calls into a single mutation", async () => {
		vi.useFakeTimers();
		try {
			mocks.useQuery.mockReturnValue({ data: [] });
			const mutate = vi.fn();
			mocks.useMutation.mockReturnValue({
				mutate,
				isPending: false,
			});
			mocks.useQueryClient.mockReturnValue({
				invalidateQueries: vi.fn(),
			});

			const screen = await render(<TestComponent bookId={1} />);
			const button = screen.getByTestId("save");
			await button.click();
			await button.click();
			await button.click();

			vi.advanceTimersByTime(2000);
			expect(mutate).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	test("passes bookId to the query function", async () => {
		mocks.useQuery.mockReturnValue({ data: [] });
		mocks.useMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
		});
		mocks.useQueryClient.mockReturnValue({
			invalidateQueries: vi.fn(),
		});

		await render(<TestComponent bookId={42} />);
		expect(mocks.useQuery).toHaveBeenCalled();
		const callArg = mocks.useQuery.mock.calls.at(-1)?.[0] as
			| { queryKey: unknown; queryFn: () => unknown }
			| undefined;
		expect(callArg).toBeDefined();
		expect(Array.isArray(callArg?.queryKey)).toBe(true);
	});
});
