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

	test("recent feed returns 401 when unauthenticated", async () => {
		authenticateOpds.mockResolvedValue(null);
		const { handleRecentOpdsRequest } = await import(
			"src/routes/api/opds/recent"
		);
		const response = await handleRecentOpdsRequest(
			new Request("https://example.com/api/opds/recent"),
		);
		expect(response.status).toBe(401);
	});

	test("recent feed returns entries when books accessible", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		getAccessibleLibraryIds.mockResolvedValue([1]);
		dbSelect
			.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						orderBy: () => ({
							limit: () =>
								Promise.resolve([
									{
										id: 1,
										libraryId: 1,
										title: "Book 1",
										createdAt: new Date(),
										updatedAt: new Date(),
										language: "en",
										publisher: "Pub",
										description: "Desc",
										coverPath: "/tmp/cover.jpg",
										pageCount: 100,
									},
								]),
						}),
					}),
				}),
			})
			.mockReturnValueOnce({
				from: () => ({
					where: () =>
						Promise.resolve([
							{ bookId: 1, id: 100, filePath: "/b.cbz", format: "cbz" },
							{ bookId: 1, id: 101, filePath: "/b.epub", format: "epub" },
						]),
				}),
			})
			.mockReturnValueOnce({
				from: () => ({
					innerJoin: () => ({
						where: () =>
							Promise.resolve([
								{ bookId: 1, id: 5, name: "Jane Doe", role: "author" },
							]),
					}),
				}),
			});
		const { handleRecentOpdsRequest } = await import(
			"src/routes/api/opds/recent"
		);
		const response = await handleRecentOpdsRequest(
			new Request("https://example.com/api/opds/recent"),
		);
		expect(response.status).toBe(200);
	});

	test("all feed returns 401 when unauthenticated", async () => {
		authenticateOpds.mockResolvedValue(null);
		const { handleAllOpdsRequest } = await import("src/routes/api/opds/all");
		const response = await handleAllOpdsRequest(
			new Request("https://example.com/api/opds/all"),
		);
		expect(response.status).toBe(401);
	});

	test("library feed returns 401 when unauthenticated", async () => {
		authenticateOpds.mockResolvedValue(null);
		const { handleLibraryOpdsRequest } = await import(
			"src/routes/api/opds/libraries.$libraryId"
		);
		const response = await handleLibraryOpdsRequest(
			new Request("https://example.com/api/opds/libraries/7"),
			{ libraryId: "7" },
		);
		expect(response.status).toBe(401);
	});

	test("library feed returns 404 for invalid library id", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		const { handleLibraryOpdsRequest } = await import(
			"src/routes/api/opds/libraries.$libraryId"
		);
		const response = await handleLibraryOpdsRequest(
			new Request("https://example.com/api/opds/libraries/abc"),
			{ libraryId: "abc" },
		);
		expect([400, 404]).toContain(response.status);
	});

	test("library feed returns 404 when library not found", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		librariesFindFirst.mockResolvedValue(undefined);
		userFindFirst.mockResolvedValue({ role: "admin" });
		const { handleLibraryOpdsRequest } = await import(
			"src/routes/api/opds/libraries.$libraryId"
		);
		const response = await handleLibraryOpdsRequest(
			new Request("https://example.com/api/opds/libraries/999"),
			{ libraryId: "999" },
		);
		expect(response.status).toBe(404);
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
