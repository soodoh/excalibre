import { describe, expect, test } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
	test("merges simple class names", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	test("handles conditional classes via clsx", () => {
		expect(cn("base", false && "hidden", "visible")).toBe("base visible");
	});

	test("deduplicates conflicting Tailwind classes", () => {
		expect(cn("p-4", "p-2")).toBe("p-2");
	});

	test("merges Tailwind responsive variants correctly", () => {
		expect(cn("text-sm", "md:text-lg", "text-base")).toBe(
			"md:text-lg text-base",
		);
	});

	test("handles undefined and null inputs", () => {
		expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
	});

	test("handles empty string inputs", () => {
		expect(cn("", "foo", "", "bar")).toBe("foo bar");
	});

	test("handles array inputs", () => {
		expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
	});

	test("handles object inputs", () => {
		expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
	});

	test("returns empty string for no arguments", () => {
		expect(cn()).toBe("");
	});

	test("resolves conflicting Tailwind color classes", () => {
		expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
	});

	test("preserves non-conflicting Tailwind classes", () => {
		expect(cn("p-4", "m-2", "text-sm")).toBe("p-4 m-2 text-sm");
	});
});
