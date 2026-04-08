import { createFileRoute } from "@tanstack/react-router";

type CreateUserBody = {
	username?: string;
	password?: string;
};

export async function handleKosyncUsersCreatePost({
	request,
}: {
	request: Request;
}): Promise<Response> {
	let body: CreateUserBody;
	try {
		body = (await request.json()) as CreateUserBody;
	} catch {
		return Response.json({ message: "Invalid request body" }, { status: 400 });
	}

	const email = body.username;
	if (!email) {
		return Response.json(
			{ message: "Username (email) is required" },
			{ status: 400 },
		);
	}

	return Response.json({ username: email }, { status: 201 });
}

export const Route = createFileRoute("/api/kosync/users/create")({
	server: {
		handlers: {
			POST: handleKosyncUsersCreatePost,
		},
	},
});
