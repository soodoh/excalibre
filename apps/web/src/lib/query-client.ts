import { QueryClient } from "@tanstack/react-query";

let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
	// oxlint-disable-next-line no-typeof-undefined
	if (typeof globalThis.window === "undefined") {
		return new QueryClient({
			defaultOptions: {
				queries: { staleTime: 30_000 },
			},
		});
	}

	browserClient ??= new QueryClient({
		defaultOptions: {
			queries: { staleTime: 30_000 },
		},
	});

	return browserClient;
}
