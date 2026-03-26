// oxlint-disable import/prefer-default-export
export const queryKeys = {
  libraries: {
    all: ["libraries"] as const,
    list: () => ["libraries", "list"] as const,
    detail: (id: number) => ["libraries", "detail", id] as const,
  },
  books: {
    all: ["books"] as const,
    list: (libraryId: number) => ["books", "list", libraryId] as const,
    detail: (id: number) => ["books", "detail", id] as const,
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
    detail: (id: number) => ["shelves", "detail", id] as const,
  },
  collections: {
    all: ["collections"] as const,
    detail: (id: number) => ["collections", "detail", id] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    list: () => ["jobs", "list"] as const,
  },
};
