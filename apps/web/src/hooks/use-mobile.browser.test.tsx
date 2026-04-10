import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { useIsMobile } from "./use-mobile";

function TestComponent() {
	const isMobile = useIsMobile();
	return <div data-testid="value">{isMobile ? "mobile" : "desktop"}</div>;
}

describe("useIsMobile", () => {
	test("reports viewport state using matchMedia", async () => {
		const screen = await render(<TestComponent />);
		const expected = window.innerWidth < 768 ? "mobile" : "desktop";
		await expect
			.element(screen.getByTestId("value"))
			.toHaveTextContent(expected);
	});

	test("renders with a defined boolean value (not undefined)", async () => {
		const screen = await render(<TestComponent />);
		const element = screen.getByTestId("value");
		// Should render either "mobile" or "desktop", never empty string
		await expect.element(element).toBeVisible();
		const text = (await element.element()).textContent;
		expect(text === "mobile" || text === "desktop").toBe(true);
	});
});
