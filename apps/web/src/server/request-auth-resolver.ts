import { auth } from "src/lib/auth";
import { UnauthorizedError } from "src/server/http-errors";
import { authenticateKobo } from "src/server/kobo";
import { authenticateOpds } from "src/server/opds";
import type { RequestAuth } from "src/server/request-auth";

export async function resolveRequestAuth(
	request: Request,
): Promise<RequestAuth | null> {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (session) {
		return {
			mode: "session",
			userId: session.user.id,
		};
	}

	const opdsAuth = await authenticateOpds(request);
	if (opdsAuth) {
		return opdsAuth;
	}

	const url = new URL(request.url);
	const koboToken = url.searchParams.get("koboToken");
	if (koboToken) {
		const koboAuth = await authenticateKobo(koboToken);
		if (koboAuth) {
			return {
				mode: "kobo",
				userId: koboAuth.userId,
				koboToken,
			};
		}
	}

	return null;
}

export async function requireRequestAuth(
	request: Request,
): Promise<RequestAuth> {
	const authResult = await resolveRequestAuth(request);
	if (!authResult) {
		throw new UnauthorizedError();
	}

	return authResult;
}
