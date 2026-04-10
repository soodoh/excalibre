import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

const mocks = vi.hoisted(() => ({
	getShelvesFn: vi.fn(),
	getCollectionsFn: vi.fn(),
	getReadingListsFn: vi.fn(),
	getBookMembershipFn: vi.fn(),
	addBookToShelfFn: vi.fn(),
	removeBookFromShelfFn: vi.fn(),
	addBookToCollectionFn: vi.fn(),
	removeBookFromCollectionFn: vi.fn(),
	addBookToReadingListFn: vi.fn(),
	removeBookFromReadingListFn: vi.fn(),
}));

vi.mock("src/server/shelves", () => ({
	getShelvesFn: () => mocks.getShelvesFn(),
	getBookMembershipFn: (...args: unknown[]) =>
		mocks.getBookMembershipFn(...args),
	addBookToShelfFn: (...args: unknown[]) => mocks.addBookToShelfFn(...args),
	removeBookFromShelfFn: (...args: unknown[]) =>
		mocks.removeBookFromShelfFn(...args),
}));

vi.mock("src/server/collections", () => ({
	getCollectionsFn: () => mocks.getCollectionsFn(),
	addBookToCollectionFn: (...args: unknown[]) =>
		mocks.addBookToCollectionFn(...args),
	removeBookFromCollectionFn: (...args: unknown[]) =>
		mocks.removeBookFromCollectionFn(...args),
}));

vi.mock("src/server/reading-lists", () => ({
	getReadingListsFn: () => mocks.getReadingListsFn(),
	addBookToReadingListFn: (...args: unknown[]) =>
		mocks.addBookToReadingListFn(...args),
	removeBookFromReadingListFn: (...args: unknown[]) =>
		mocks.removeBookFromReadingListFn(...args),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

import { AddToShelf } from "./add-to-shelf";

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

describe("AddToShelf", () => {
	test("renders trigger element", async () => {
		mocks.getShelvesFn.mockResolvedValue([]);
		mocks.getCollectionsFn.mockResolvedValue([]);
		mocks.getReadingListsFn.mockResolvedValue([]);
		mocks.getBookMembershipFn.mockResolvedValue({
			shelfIds: [],
			collectionIds: [],
			readingListIds: [],
		});

		const screen = await render(
			<AddToShelf
				bookId={1}
				trigger={<button type="button">Add to...</button>}
			/>,
			{ wrapper: createWrapper() },
		);
		await expect
			.element(screen.getByRole("button", { name: "Add to..." }))
			.toBeVisible();
	});

	test("opens dropdown menu with section labels", async () => {
		mocks.getShelvesFn.mockResolvedValue([]);
		mocks.getCollectionsFn.mockResolvedValue([]);
		mocks.getReadingListsFn.mockResolvedValue([]);
		mocks.getBookMembershipFn.mockResolvedValue({
			shelfIds: [],
			collectionIds: [],
			readingListIds: [],
		});

		const screen = await render(
			<AddToShelf
				bookId={1}
				trigger={<button type="button">Add to...</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Add to..." }).click();
		await expect.element(page.getByRole("menu")).toBeVisible();
		// Use the dropdown-menu-label data-slot to target section labels specifically
		await expect.element(page.getByText("No shelves")).toBeVisible();
		await expect.element(page.getByText("No collections")).toBeVisible();
		await expect.element(page.getByText("No reading lists")).toBeVisible();
	});

	test("shows empty state messages when no items exist", async () => {
		mocks.getShelvesFn.mockResolvedValue([]);
		mocks.getCollectionsFn.mockResolvedValue([]);
		mocks.getReadingListsFn.mockResolvedValue([]);
		mocks.getBookMembershipFn.mockResolvedValue({
			shelfIds: [],
			collectionIds: [],
			readingListIds: [],
		});

		const screen = await render(
			<AddToShelf
				bookId={1}
				trigger={<button type="button">Add to...</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Add to..." }).click();
		await expect.element(page.getByText("No shelves")).toBeVisible();
		await expect.element(page.getByText("No collections")).toBeVisible();
		await expect.element(page.getByText("No reading lists")).toBeVisible();
	});

	test("shows shelf names when shelves exist", async () => {
		mocks.getShelvesFn.mockResolvedValue([
			{ id: 1, name: "Favorites", type: "manual" },
			{ id: 2, name: "To Read", type: "manual" },
		]);
		mocks.getCollectionsFn.mockResolvedValue([]);
		mocks.getReadingListsFn.mockResolvedValue([]);
		mocks.getBookMembershipFn.mockResolvedValue({
			shelfIds: [],
			collectionIds: [],
			readingListIds: [],
		});

		const screen = await render(
			<AddToShelf
				bookId={1}
				trigger={<button type="button">Add to...</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Add to..." }).click();
		await expect.element(page.getByText("Favorites")).toBeVisible();
		await expect.element(page.getByText("To Read")).toBeVisible();
	});

	test("filters out non-manual shelves", async () => {
		mocks.getShelvesFn.mockResolvedValue([
			{ id: 1, name: "My Manual", type: "manual" },
			{ id: 2, name: "Smart Shelf", type: "smart" },
		]);
		mocks.getCollectionsFn.mockResolvedValue([]);
		mocks.getReadingListsFn.mockResolvedValue([]);
		mocks.getBookMembershipFn.mockResolvedValue({
			shelfIds: [],
			collectionIds: [],
			readingListIds: [],
		});

		const screen = await render(
			<AddToShelf
				bookId={1}
				trigger={<button type="button">Add to...</button>}
			/>,
			{ wrapper: createWrapper() },
		);

		await screen.getByRole("button", { name: "Add to..." }).click();
		await expect.element(page.getByText("My Manual")).toBeVisible();
		await expect.element(page.getByText("Smart Shelf")).not.toBeInTheDocument();
	});
});
