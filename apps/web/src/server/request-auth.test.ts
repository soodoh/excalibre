import {
	appendRequestAuthToUrl,
	buildRequestAuthQuery,
} from "src/server/request-auth";
import { describe, expect, test } from "vitest";

describe("buildRequestAuthQuery", () => {
	test("returns no query suffix for session-backed requests", () => {
		expect(
			buildRequestAuthQuery({
				mode: "session",
				userId: "user-1",
			}),
		).toBe("");
	});

	test("returns an OPDS api key suffix for OPDS asset requests", () => {
		expect(
			buildRequestAuthQuery({
				mode: "opds",
				userId: "user-1",
				apiKey: "opds-secret",
			}),
		).toBe("?apikey=opds-secret");
	});

	test("returns a Kobo token suffix for Kobo asset requests", () => {
		expect(
			buildRequestAuthQuery({
				mode: "kobo",
				userId: "user-1",
				koboToken: "kobo-secret",
			}),
		).toBe("?koboToken=kobo-secret");
	});
});

describe("appendRequestAuthToUrl", () => {
	test("adds auth query parameters to URLs without an existing query string", () => {
		expect(
			appendRequestAuthToUrl("https://example.com/api/covers/42", {
				mode: "opds",
				userId: "user-1",
				apiKey: "opds-secret",
			}),
		).toBe("https://example.com/api/covers/42?apikey=opds-secret");
	});

	test("preserves existing query parameters when appending auth", () => {
		expect(
			appendRequestAuthToUrl("https://example.com/api/opds/all?page=2", {
				mode: "opds",
				userId: "user-1",
				apiKey: "opds-secret",
			}),
		).toBe("https://example.com/api/opds/all?page=2&apikey=opds-secret");
	});

	test("appends auth to OPDS self links that already contain a page query", () => {
		expect(
			appendRequestAuthToUrl(
				"https://example.com/api/opds/libraries/9?page=3",
				{
					mode: "opds",
					userId: "user-1",
					apiKey: "feed-key",
				},
			),
		).toBe("https://example.com/api/opds/libraries/9?page=3&apikey=feed-key");
	});
});
