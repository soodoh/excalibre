import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "src/db";
import { user } from "src/db/schema";

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

				const existingUser = await db.query.user.findFirst({
					where: eq(user.email, email),
				});

				if (existingUser) {
					return Response.json({ username: email }, { status: 201 });
				}

				return Response.json(
					{
						message:
							"Username not found. Register at the Excalibre web UI first.",
					},
					{ status: 402 },
				);
			},
		},
	},
});
