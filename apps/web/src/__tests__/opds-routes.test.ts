import { beforeEach, describe, expect, test, vi } from "vitest";

const authenticateOpds = vi.fn();
const getAccessibleLibraryIds = vi.fn();
const dbSelect = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelect,
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
	return match?.[1];
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
		expect(getLinkHref(xml, "self")).toBe(
			"https://example.com/api/opds/recent?apikey=feed-key",
		);
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
		expect(getLinkHref(xml, "previous")).toBe(
			"https://example.com/api/opds/all?page=0&amp;apikey=feed-key",
		);
		expect(getLinkHref(xml, "next")).toBe(
			"https://example.com/api/opds/all?page=2&amp;apikey=feed-key",
		);
	});
});
