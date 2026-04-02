export const queryKeys = {
	libraries: {
		all: ["libraries"] as const,
		list: () => ["libraries", "list"] as const,
		detail: (id: number) => ["libraries", "detail", id] as const,
	},
	books: {
		all: ["books"] as const,
		list: (
			libraryId: number,
			search?: string,
		):
			| readonly ["books", "list", number, string]
			| readonly ["books", "list", number] =>
			search
				? (["books", "list", libraryId, search] as const)
				: (["books", "list", libraryId] as const),
		detail: (id: number) => ["books", "detail", id] as const,
		recent: (limit?: number) => ["books", "recent", limit ?? 12] as const,
	},
	authors: {
		all: ["authors"] as const,
		detail: (id: number) => ["authors", "detail", id] as const,
	},
	series: {
		all: ["series"] as const,
		detail: (id: number) => ["series", "detail", id] as const,
	},
	shelves: {
		all: ["shelves"] as const,
		list: () => ["shelves", "list"] as const,
		detail: (id: number) => ["shelves", "detail", id] as const,
		books: (id: number) => ["shelves", "books", id] as const,
	},
	collections: {
		all: ["collections"] as const,
		list: () => ["collections", "list"] as const,
		detail: (id: number) => ["collections", "detail", id] as const,
		books: (id: number) => ["collections", "books", id] as const,
	},
	readingLists: {
		all: ["readingLists"] as const,
		list: () => ["readingLists", "list"] as const,
		detail: (id: number) => ["readingLists", "detail", id] as const,
		books: (id: number) => ["readingLists", "books", id] as const,
	},
	search: {
		results: (query: string) => ["search", "results", query] as const,
	},
	continueReading: {
		list: () => ["continueReading", "list"] as const,
	},
	jobs: {
		all: ["jobs"] as const,
		list: () => ["jobs", "list"] as const,
	},
	scan: {
		status: (libraryId: number) => ["scan", "status", libraryId] as const,
	},
	reading: {
		progress: (bookId: number) => ["reading", "progress", bookId] as const,
		annotations: (bookId: number) =>
			["reading", "annotations", bookId] as const,
	},
};
