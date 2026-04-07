import { createFileRoute } from "@tanstack/react-router";

type CreateUserBody = {
	username?: string;
	password?: string;
};

export const Route = createFileRoute("/api/kosync/users/create")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				let body: CreateUserBody;
				try {
					body = (await request.json()) as CreateUserBody;
				} catch {
					return Response.json(
						{ message: "Invalid request body" },
						{ status: 400 },
					);
				}

				const email = body.username;
				if (!email) {
					return Response.json(
						{ message: "Username (email) is required" },
						{ status: 400 },
					);
				}

				return Response.json(
					{
						message: "Registration is disabled after initial setup.",
					},
					{ status: 403 },
				);
			},
		},
	},
});
