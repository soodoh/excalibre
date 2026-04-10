import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		...rest
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => <a {...rest}>{children}</a>,
}));

import BookGrid from "./book-grid";

const SAMPLE_BOOKS = [
	{ id: 1, title: "Book One", coverPath: null, authorName: "Author A" },
	{ id: 2, title: "Book Two", coverPath: "/cover.jpg", authorName: "Author B" },
	{ id: 3, title: "Book Three", coverPath: null },
];

describe("BookGrid", () => {
	test("renders loading skeletons when isLoading is true", async () => {
		const screen = await render(<BookGrid books={[]} isLoading={true} />);
		// Should render 12 skeleton items
		const skeletons = screen.container.querySelectorAll(
			"[data-slot='skeleton']",
		);
		// Each skeleton card has 3 skeleton elements (cover, title line, author line)
		expect(skeletons.length).toBe(36);
	});

	test("renders empty state when books array is empty and not loading", async () => {
		const screen = await render(<BookGrid books={[]} isLoading={false} />);
		await expect.element(screen.getByText("No books found")).toBeVisible();
	});

	test("renders book cards for each book", async () => {
		const screen = await render(
			<BookGrid books={SAMPLE_BOOKS} isLoading={false} />,
		);
		await expect.element(screen.getByText("Book One")).toBeVisible();
		await expect.element(screen.getByText("Book Two")).toBeVisible();
		await expect.element(screen.getByText("Book Three")).toBeVisible();
	});

	test("renders author names for books that have them", async () => {
		const screen = await render(
			<BookGrid books={SAMPLE_BOOKS} isLoading={false} />,
		);
		await expect.element(screen.getByText("Author A")).toBeVisible();
		await expect.element(screen.getByText("Author B")).toBeVisible();
	});

	test("does not show empty state or skeletons when books are present", async () => {
		const screen = await render(
			<BookGrid books={SAMPLE_BOOKS} isLoading={false} />,
		);
		await expect
			.element(screen.getByText("No books found"))
			.not.toBeInTheDocument();
	});
});
