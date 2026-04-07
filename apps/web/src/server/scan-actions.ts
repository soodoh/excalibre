import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "src/server/middleware";
import { z } from "zod";

export const triggerScanFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) =>
		z.object({ libraryId: z.number().int() }).parse(raw),
	)
	.handler(async ({ data }) => {
		await requireAdmin();
		const { scanLibrary } = await import("./scanner");
		return scanLibrary(data.libraryId);
	});

export const triggerScanAllFn = createServerFn({ method: "POST" }).handler(
	async () => {
		await requireAdmin();
		const { scanAllLibraries } = await import("./scanner");
		return scanAllLibraries();
	},
);
