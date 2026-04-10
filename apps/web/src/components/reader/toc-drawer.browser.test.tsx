import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import type { TocItem } from "./toc-drawer";
import { TocDrawer } from "./toc-drawer";

const SAMPLE_TOC: TocItem[] = [
	{ label: "Chapter 1: Introduction", href: "#ch1" },
	{ label: "Chapter 2: Getting Started", href: "#ch2" },
	{
		label: "Chapter 3: Advanced Topics",
		href: "#ch3",
		subitems: [
			{ label: "3.1 Subtopic A", href: "#ch3-1" },
			{ label: "3.2 Subtopic B", href: "#ch3-2" },
		],
	},
];

describe("TocDrawer", () => {
	test("renders sheet with title when open", async () => {
		await render(
			<TocDrawer
				open={true}
				onOpenChange={vi.fn()}
				toc={SAMPLE_TOC}
				onSelect={vi.fn()}
			/>,
		);

		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.getByText("Table of Contents")).toBeVisible();
	});

	test("does not render dialog when closed", async () => {
		await render(
			<TocDrawer
				open={false}
				onOpenChange={vi.fn()}
				toc={SAMPLE_TOC}
				onSelect={vi.fn()}
			/>,
		);

		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	test("renders all top-level TOC items", async () => {
		await render(
			<TocDrawer
				open={true}
				onOpenChange={vi.fn()}
				toc={SAMPLE_TOC}
				onSelect={vi.fn()}
			/>,
		);

		await expect
			.element(page.getByText("Chapter 1: Introduction"))
			.toBeVisible();
		await expect
			.element(page.getByText("Chapter 2: Getting Started"))
			.toBeVisible();
		await expect
			.element(page.getByText("Chapter 3: Advanced Topics"))
			.toBeVisible();
	});

	test("renders subitems", async () => {
		await render(
			<TocDrawer
				open={true}
				onOpenChange={vi.fn()}
				toc={SAMPLE_TOC}
				onSelect={vi.fn()}
			/>,
		);

		await expect.element(page.getByText("3.1 Subtopic A")).toBeVisible();
		await expect.element(page.getByText("3.2 Subtopic B")).toBeVisible();
	});

	test("shows empty state when TOC is empty", async () => {
		await render(
			<TocDrawer
				open={true}
				onOpenChange={vi.fn()}
				toc={[]}
				onSelect={vi.fn()}
			/>,
		);

		await expect
			.element(page.getByText("No table of contents available."))
			.toBeVisible();
	});

	test("calls onSelect when a TOC item is clicked", async () => {
		const onSelect = vi.fn();
		await render(
			<TocDrawer
				open={true}
				onOpenChange={vi.fn()}
				toc={SAMPLE_TOC}
				onSelect={onSelect}
			/>,
		);

		await page.getByText("Chapter 2: Getting Started").click();
		expect(onSelect).toHaveBeenCalledWith("#ch2");
	});

	test("calls onSelect when a subitem is clicked", async () => {
		const onSelect = vi.fn();
		await render(
			<TocDrawer
				open={true}
				onOpenChange={vi.fn()}
				toc={SAMPLE_TOC}
				onSelect={onSelect}
			/>,
		);

		await page.getByText("3.1 Subtopic A").click();
		expect(onSelect).toHaveBeenCalledWith("#ch3-1");
	});
});
