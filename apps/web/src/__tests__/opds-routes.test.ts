import { beforeEach, describe, expect, test, vi } from "vitest";

const authenticateOpds = vi.fn();
const getAccessibleLibraryIds = vi.fn();
const dbSelect = vi.fn();
const librariesFindFirst = vi.fn();
const userFindFirst = vi.fn();
const libraryAccessFindFirst = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelect,
		query: {
			libraries: { findFirst: librariesFindFirst },
			user: { findFirst: userFindFirst },
			libraryAccess: { findFirst: libraryAccessFindFirst },
		},
	},
}));

vi.mock("src/server/opds", async () => {
	const actual =
		await vi.importActual<typeof import("src/server/opds")>("src/server/opds");
	return {
		...actual,
		authenticateOpds,
		getAccessibleLibraryIds,
	};
});

function getLinkHref(xml: string, rel: string): string | undefined {
	const match = xml.match(
		new RegExp(`<link[^>]*rel="${rel}"[^>]*href="([^"]+)"`),
	);
	return match?.[1].replaceAll("&amp;", "&");
}

function getLinkUrl(xml: string, rel: string): URL {
	const href = getLinkHref(xml, rel);
	expect(href).toBeDefined();
	return new URL(href as string);
}

describe("OPDS route auth propagation", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("recent feed preserves apikey on the self link when no libraries are accessible", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		getAccessibleLibraryIds.mockResolvedValue([]);

		const { handleRecentOpdsRequest } = await import(
			"src/routes/api/opds/recent"
		);
		const response = await handleRecentOpdsRequest(
			new Request("https://example.com/api/opds/recent?apikey=feed-key"),
		);

		expect(response.status).toBe(200);
		const xml = await response.text();
		const self = getLinkUrl(xml, "self");
		expect(self.pathname).toBe("/api/opds/recent");
		expect(self.searchParams.get("apikey")).toBe("feed-key");
	});

	test("all feed preserves apikey on previous and next pagination links", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		getAccessibleLibraryIds.mockResolvedValue([7]);
		dbSelect
			.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						orderBy: () => ({
							limit: () => ({
								offset: () => Promise.resolve([]),
							}),
						}),
					}),
				}),
			})
			.mockReturnValueOnce({
				from: () => ({
					where: () => Promise.resolve([{ value: 151 }]),
				}),
			});

		const { handleAllOpdsRequest } = await import("src/routes/api/opds/all");
		const response = await handleAllOpdsRequest(
			new Request("https://example.com/api/opds/all?page=1&apikey=feed-key"),
		);

		expect(response.status).toBe(200);
		const xml = await response.text();
		const previous = getLinkUrl(xml, "previous");
		expect(previous.pathname).toBe("/api/opds/all");
		expect(previous.searchParams.get("page")).toBe("0");
		expect(previous.searchParams.get("apikey")).toBe("feed-key");

		const next = getLinkUrl(xml, "next");
		expect(next.pathname).toBe("/api/opds/all");
		expect(next.searchParams.get("page")).toBe("2");
		expect(next.searchParams.get("apikey")).toBe("feed-key");
	});

	test("library feed preserves apikey on previous and next pagination links", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		librariesFindFirst.mockResolvedValue({ id: 7, name: "Main Library" });
		userFindFirst.mockResolvedValue({ role: "admin" });
		dbSelect
			.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						orderBy: () => ({
							limit: () => ({
								offset: () => Promise.resolve([]),
							}),
						}),
					}),
				}),
			})
			.mockReturnValueOnce({
				from: () => ({
					where: () => Promise.resolve([{ value: 151 }]),
				}),
			});

		const { handleLibraryOpdsRequest } = await import(
			"src/routes/api/opds/libraries.$libraryId"
		);
		const response = await handleLibraryOpdsRequest(
			new Request(
				"https://example.com/api/opds/libraries/7?page=1&apikey=feed-key",
			),
			{ libraryId: "7" },
		);

		expect(response.status).toBe(200);
		const xml = await response.text();
		const previous = getLinkUrl(xml, "previous");
		expect(previous.pathname).toBe("/api/opds/libraries/7");
		expect(previous.searchParams.get("page")).toBe("0");
		expect(previous.searchParams.get("apikey")).toBe("feed-key");

		const next = getLinkUrl(xml, "next");
		expect(next.pathname).toBe("/api/opds/libraries/7");
		expect(next.searchParams.get("page")).toBe("2");
		expect(next.searchParams.get("apikey")).toBe("feed-key");
	});
});
