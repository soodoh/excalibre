import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { ReaderProgressBar } from "./reader-progress-bar";

describe("ReaderProgressBar", () => {
	test("renders position label", async () => {
		const screen = await render(
			<ReaderProgressBar
				fraction={0.5}
				positionLabel="Chapter 5"
				visible={true}
			/>,
		);
		await expect.element(screen.getByText("Chapter 5")).toBeVisible();
	});

	test("renders percentage from fraction", async () => {
		const screen = await render(
			<ReaderProgressBar
				fraction={0.75}
				positionLabel="Page 30"
				visible={true}
			/>,
		);
		await expect.element(screen.getByText("75%")).toBeVisible();
	});

	test("renders 0% for fraction 0", async () => {
		const screen = await render(
			<ReaderProgressBar fraction={0} positionLabel="Start" visible={true} />,
		);
		await expect.element(screen.getByText("0%")).toBeVisible();
	});

	test("renders 100% for fraction 1", async () => {
		const screen = await render(
			<ReaderProgressBar fraction={1} positionLabel="End" visible={true} />,
		);
		await expect.element(screen.getByText("100%")).toBeVisible();
	});

	test("shows saving indicator when isSaving is true", async () => {
		const screen = await render(
			<ReaderProgressBar
				fraction={0.5}
				positionLabel="Page 10"
				isSaving={true}
				visible={true}
			/>,
		);
		await expect.element(screen.getByText("Saving\u2026")).toBeVisible();
	});

	test("does not show saving indicator when isSaving is false", async () => {
		const screen = await render(
			<ReaderProgressBar
				fraction={0.5}
				positionLabel="Page 10"
				isSaving={false}
				visible={true}
			/>,
		);
		await expect
			.element(screen.getByText("Saving\u2026"))
			.not.toBeInTheDocument();
	});

	test("rounds percentage correctly", async () => {
		const screen = await render(
			<ReaderProgressBar
				fraction={0.333}
				positionLabel="Page 5"
				visible={true}
			/>,
		);
		await expect.element(screen.getByText("33%")).toBeVisible();
	});
});
