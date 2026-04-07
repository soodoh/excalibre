import { z } from "zod";

function isValidLibraryScanPath(scanPath: string): boolean {
	if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(scanPath)) {
		return false;
	}

	let depth = 0;
	for (const segment of scanPath.split(/[\\/]+/)) {
		if (segment.length === 0 || segment === ".") {
			continue;
		}
		if (segment === "..") {
			if (depth === 0) {
				return false;
			}
			depth -= 1;
			continue;
		}
		depth += 1;
	}

	return true;
}

export const createShelfSchema = z.object({
	name: z.string().min(1, "Name is required"),
	type: z.enum(["smart", "manual"]),
	filterRules: z.record(z.string(), z.any()).optional(),
});

export const createCollectionSchema = z.object({
	name: z.string().min(1, "Name is required"),
});

export const createReadingListSchema = z.object({
	name: z.string().min(1, "Name is required"),
});

export type CreateShelfInput = z.infer<typeof createShelfSchema>;
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type CreateReadingListInput = z.infer<typeof createReadingListSchema>;

export const createLibrarySchema = z.object({
	name: z.string().min(1, "Name is required"),
	type: z.enum(["book", "comic", "manga"]),
	scanPaths: z
		.array(
			z
				.string()
				.min(1)
				.refine((value) => isValidLibraryScanPath(value), {
					message: "Scan paths cannot escape DATA_DIR",
				}),
		)
		.min(1, "At least one scan path is required"),
	scanInterval: z.number().int().min(1).default(30),
});

export type CreateLibraryFormInput = z.input<typeof createLibrarySchema>;

export const updateLibrarySchema = createLibrarySchema.partial().extend({
	id: z.number().int(),
});

export type CreateLibraryInput = z.infer<typeof createLibrarySchema>;
export type UpdateLibraryInput = z.infer<typeof updateLibrarySchema>;
