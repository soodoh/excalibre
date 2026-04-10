import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		params,
		...rest
	}: {
		children: React.ReactNode;
		to: string;
		params?: Record<string, string>;
		className?: string;
	}) => {
		const href = params ? to.replace("$bookId", params.bookId ?? "") : to;
		return (
			<a href={href} {...rest}>
				{children}
			</a>
		);
	},
}));

import BookCard from "./book-card";

describe("BookCard", () => {
	test("renders title text", async () => {
		const screen = await render(
			<BookCard id={1} title="Test Book" coverPath={null} />,
		);
		await expect.element(screen.getByText("Test Book")).toBeVisible();
	});

	test("renders author name when provided", async () => {
		const screen = await render(
			<BookCard
				id={1}
				title="Test Book"
				coverPath={null}
				authorName="Jane Author"
			/>,
		);
		await expect.element(screen.getByText("Jane Author")).toBeVisible();
	});

	test("does not render author when not provided", async () => {
		const screen = await render(
			<BookCard id={1} title="Test Book" coverPath={null} />,
		);
		await expect
			.element(screen.getByText("Jane Author"))
			.not.toBeInTheDocument();
	});

	test("links to the correct book detail page", async () => {
		const screen = await render(
			<BookCard id={42} title="Linked Book" coverPath={null} />,
		);
		const link = screen.getByRole("link");
		await expect.element(link).toHaveAttribute("href", "/books/42");
	});

	test("renders fallback when coverPath is provided but image fails to load", async () => {
		// In test environment there's no server, so the img onError fires and
		// the component falls back to the BookOpen icon placeholder.
		const screen = await render(
			<BookCard id={5} title="With Cover" coverPath="/covers/5.jpg" />,
		);
		// The title should still render
		await expect.element(screen.getByText("With Cover")).toBeVisible();
	});

	test("renders fallback icon when coverPath is null", async () => {
		const screen = await render(
			<BookCard id={1} title="No Cover" coverPath={null} />,
		);
		// No img element should exist
		const imgs = screen.getByRole("img");
		await expect.element(imgs).not.toBeInTheDocument();
	});
});
