import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/kosync/healthcheck")({
	server: {
		handlers: {
			GET: () => {
				return Response.json({ state: "OK" });
			},
		},
	},
});
