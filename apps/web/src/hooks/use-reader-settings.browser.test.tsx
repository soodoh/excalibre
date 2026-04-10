import { beforeEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { useReaderSettings } from "./use-reader-settings";

const STORAGE_KEY = "excalibre-reader-settings";

function TestComponent() {
	const { settings, updateSettings, resetSettings } = useReaderSettings();
	return (
		<div>
			<div data-testid="fontSize">{settings.fontSize}</div>
			<div data-testid="fontFamily">{settings.fontFamily}</div>
			<div data-testid="lineHeight">{settings.lineHeight}</div>
			<div data-testid="theme">{settings.theme}</div>
			<div data-testid="layout">{settings.layout}</div>
			<div data-testid="margin">{settings.margin}</div>
			<button
				data-testid="update-font"
				onClick={() => updateSettings({ fontSize: 24 })}
				type="button"
			>
				Update Font
			</button>
			<button
				data-testid="update-theme"
				onClick={() => updateSettings({ theme: "sepia" })}
				type="button"
			>
				Update Theme
			</button>
			<button data-testid="reset" onClick={resetSettings} type="button">
				Reset
			</button>
		</div>
	);
}

describe("useReaderSettings", () => {
	beforeEach(() => {
		localStorage.removeItem(STORAGE_KEY);
	});

	test("returns default settings when no localStorage value", async () => {
		const screen = await render(<TestComponent />);
		await expect
			.element(screen.getByTestId("fontSize"))
			.toHaveTextContent("18");
		await expect
			.element(screen.getByTestId("fontFamily"))
			.toHaveTextContent("Georgia, serif");
		await expect
			.element(screen.getByTestId("lineHeight"))
			.toHaveTextContent("1.6");
		await expect.element(screen.getByTestId("theme")).toHaveTextContent("dark");
		await expect
			.element(screen.getByTestId("layout"))
			.toHaveTextContent("paginated");
		await expect.element(screen.getByTestId("margin")).toHaveTextContent("48");
	});

	test("loads previously stored settings from localStorage", async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ fontSize: 22, theme: "light" }),
		);
		const screen = await render(<TestComponent />);
		await expect
			.element(screen.getByTestId("fontSize"))
			.toHaveTextContent("22");
		await expect
			.element(screen.getByTestId("theme"))
			.toHaveTextContent("light");
		// Other keys still fall back to defaults
		await expect
			.element(screen.getByTestId("fontFamily"))
			.toHaveTextContent("Georgia, serif");
	});

	test("updateSettings persists changes to localStorage", async () => {
		const screen = await render(<TestComponent />);
		await screen.getByTestId("update-font").click();
		await expect
			.element(screen.getByTestId("fontSize"))
			.toHaveTextContent("24");

		const raw = localStorage.getItem(STORAGE_KEY);
		expect(raw).not.toBeNull();
		const parsed = JSON.parse(raw ?? "{}") as { fontSize: number };
		expect(parsed.fontSize).toBe(24);
	});

	test("updateSettings merges with existing settings", async () => {
		const screen = await render(<TestComponent />);
		await screen.getByTestId("update-font").click();
		await screen.getByTestId("update-theme").click();

		await expect
			.element(screen.getByTestId("fontSize"))
			.toHaveTextContent("24");
		await expect
			.element(screen.getByTestId("theme"))
			.toHaveTextContent("sepia");

		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed = JSON.parse(raw ?? "{}") as {
			fontSize: number;
			theme: string;
		};
		expect(parsed.fontSize).toBe(24);
		expect(parsed.theme).toBe("sepia");
	});

	test("resetSettings clears localStorage and restores defaults", async () => {
		const screen = await render(<TestComponent />);
		await screen.getByTestId("update-font").click();
		await expect
			.element(screen.getByTestId("fontSize"))
			.toHaveTextContent("24");

		await screen.getByTestId("reset").click();
		await expect
			.element(screen.getByTestId("fontSize"))
			.toHaveTextContent("18");
		await expect.element(screen.getByTestId("theme")).toHaveTextContent("dark");
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});
});
