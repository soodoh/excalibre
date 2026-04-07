export class HttpError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "HttpError";
	}
}

export class UnauthorizedError extends HttpError {
	constructor(message = "Unauthorized") {
		super(message, 401);
		this.name = "UnauthorizedError";
	}
}

export class ForbiddenError extends HttpError {
	constructor(message = "Forbidden") {
		super(message, 403);
		this.name = "ForbiddenError";
	}
}

export class NotFoundError extends HttpError {
	constructor(message = "Not found") {
		super(message, 404);
		this.name = "NotFoundError";
	}
}

export function responseFromHttpError(error: unknown): Response | null {
	if (error instanceof HttpError) {
		return new Response(error.message, { status: error.status });
	}

	return null;
}
