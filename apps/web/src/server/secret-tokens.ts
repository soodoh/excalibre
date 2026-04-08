import { createHash } from "node:crypto";

const SECRET_PREVIEW_LENGTH = 4;

export function hashSecret(secret: string): string {
	return createHash("sha256").update(secret).digest("hex");
}

export function maskSecret(secret: string): string {
	return `${secret.slice(0, SECRET_PREVIEW_LENGTH)}${"*".repeat(
		Math.max(0, secret.length - SECRET_PREVIEW_LENGTH),
	)}`;
}
