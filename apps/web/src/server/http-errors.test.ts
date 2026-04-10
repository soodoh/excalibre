import {
	ForbiddenError,
	HttpError,
	NotFoundError,
	responseFromHttpError,
	UnauthorizedError,
} from "src/server/http-errors";
import { describe, expect, test } from "vitest";

describe("HttpError classes", () => {
	describe("HttpError", () => {
		test("stores message and status", () => {
			const error = new HttpError("Something went wrong", 500);
			expect(error.message).toBe("Something went wrong");
			expect(error.status).toBe(500);
			expect(error.name).toBe("HttpError");
		});

		test("is an instance of Error", () => {
			const error = new HttpError("test", 400);
			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(HttpError);
		});
	});

	describe("UnauthorizedError", () => {
		test("defaults to 401 with 'Unauthorized' message", () => {
			const error = new UnauthorizedError();
			expect(error.message).toBe("Unauthorized");
			expect(error.status).toBe(401);
			expect(error.name).toBe("UnauthorizedError");
		});

		test("accepts a custom message", () => {
			const error = new UnauthorizedError("Token expired");
			expect(error.message).toBe("Token expired");
			expect(error.status).toBe(401);
		});

		test("is an instance of HttpError", () => {
			const error = new UnauthorizedError();
			expect(error).toBeInstanceOf(HttpError);
		});
	});

	describe("ForbiddenError", () => {
		test("defaults to 403 with 'Forbidden' message", () => {
			const error = new ForbiddenError();
			expect(error.message).toBe("Forbidden");
			expect(error.status).toBe(403);
			expect(error.name).toBe("ForbiddenError");
		});

		test("accepts a custom message", () => {
			const error = new ForbiddenError("Admin only");
			expect(error.message).toBe("Admin only");
			expect(error.status).toBe(403);
		});

		test("is an instance of HttpError", () => {
			const error = new ForbiddenError();
			expect(error).toBeInstanceOf(HttpError);
		});
	});

	describe("NotFoundError", () => {
		test("defaults to 404 with 'Not found' message", () => {
			const error = new NotFoundError();
			expect(error.message).toBe("Not found");
			expect(error.status).toBe(404);
			expect(error.name).toBe("NotFoundError");
		});

		test("accepts a custom message", () => {
			const error = new NotFoundError("Book not found");
			expect(error.message).toBe("Book not found");
			expect(error.status).toBe(404);
		});

		test("is an instance of HttpError", () => {
			const error = new NotFoundError();
			expect(error).toBeInstanceOf(HttpError);
		});
	});
});

describe("responseFromHttpError", () => {
	test("returns a plain text Response for an HttpError", async () => {
		const error = new UnauthorizedError();
		const response = responseFromHttpError(error);

		expect(response).toBeInstanceOf(Response);
		expect(response?.status).toBe(401);
		expect(await response?.text()).toBe("Unauthorized");
	});

	test("returns a JSON Response when asJsonError is true", async () => {
		const error = new ForbiddenError("Admin only");
		const response = responseFromHttpError(error, { asJsonError: true });

		expect(response).toBeInstanceOf(Response);
		expect(response?.status).toBe(403);
		expect(await response?.json()).toEqual({ error: "Admin only" });
	});

	test("returns null for a non-HttpError", () => {
		const error = new Error("regular error");
		const response = responseFromHttpError(error);
		expect(response).toBeNull();
	});

	test("returns null for a non-error value", () => {
		expect(responseFromHttpError("string error")).toBeNull();
		expect(responseFromHttpError(42)).toBeNull();
		expect(responseFromHttpError(null)).toBeNull();
		expect(responseFromHttpError(undefined)).toBeNull();
	});

	test("returns plain text Response by default (asJsonError not set)", async () => {
		const error = new NotFoundError("Book not found");
		const response = responseFromHttpError(error);

		expect(response?.status).toBe(404);
		expect(await response?.text()).toBe("Book not found");
	});

	test("preserves status from base HttpError with custom status", async () => {
		const error = new HttpError("Rate limited", 429);
		const response = responseFromHttpError(error);

		expect(response?.status).toBe(429);
		expect(await response?.text()).toBe("Rate limited");
	});
});
