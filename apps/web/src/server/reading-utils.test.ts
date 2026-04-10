import { normalizeReadingProgress } from "src/server/reading-utils";
import { describe, expect, test } from "vitest";

describe("normalizeReadingProgress", () => {
	test("clamps negative progress to zero", () => {
		expect(normalizeReadingProgress(-0.5)).toBe(0);
	});

	test("preserves progress values within range", () => {
		expect(normalizeReadingProgress(0.42)).toBe(0.42);
	});

	test("clamps values above one", () => {
		expect(normalizeReadingProgress(1.8)).toBe(1);
	});
});
