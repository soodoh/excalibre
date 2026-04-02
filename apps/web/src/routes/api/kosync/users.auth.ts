import { createFileRoute } from "@tanstack/react-router";
import { authenticateKosync } from "src/server/kosync";

export const Route = createFileRoute("/api/kosync/users/auth")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const user = await authenticateKosync(request);

				if (!user) {
					return Response.json({ message: "Unauthorized" }, { status: 401 });
				}

				return Response.json({ authorized: "OK" });
			},
		},
	},
});
