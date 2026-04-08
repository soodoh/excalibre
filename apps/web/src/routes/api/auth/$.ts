import { createFileRoute } from "@tanstack/react-router";
import { auth, getUserCount } from "src/lib/auth";

const SIGN_UP_EMAIL_PATH = "/api/auth/sign-up/email";

export async function handleAuthRequest(request: Request): Promise<Response> {
	if (
		request.method === "POST" &&
		new URL(request.url).pathname === SIGN_UP_EMAIL_PATH &&
		getUserCount() > 0
	) {
		return Response.json(
			{ message: "Registration is disabled after initial setup." },
			{ status: 403 },
		);
	}

	return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }: { request: Request }) => handleAuthRequest(request),
			POST: ({ request }: { request: Request }) => handleAuthRequest(request),
		},
	},
});
