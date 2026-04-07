export type RequestAuth =
	| {
			mode: "session";
			userId: string;
	  }
	| {
			mode: "opds";
			userId: string;
			apiKey?: string;
	  }
	| {
			mode: "kobo";
			userId: string;
			koboToken: string;
	  };

export function buildRequestAuthQuery(auth: RequestAuth): string {
	switch (auth.mode) {
		case "session":
			return "";
		case "opds":
			return auth.apiKey ? `?apikey=${encodeURIComponent(auth.apiKey)}` : "";
		case "kobo":
			return `?koboToken=${encodeURIComponent(auth.koboToken)}`;
	}
}

export function appendRequestAuthToUrl(url: string, auth: RequestAuth): string {
	const suffix = buildRequestAuthQuery(auth);
	if (!suffix) {
		return url;
	}

	return `${url}${url.includes("?") ? "&" : "?"}${suffix.slice(1)}`;
}
