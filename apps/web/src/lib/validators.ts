import { z } from "zod";

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
		.array(z.string().min(1))
		.min(1, "At least one scan path is required"),
	scanInterval: z.number().int().min(1).default(30),
});

export type CreateLibraryFormInput = z.input<typeof createLibrarySchema>;

export const updateLibrarySchema = createLibrarySchema.partial().extend({
	id: z.number().int(),
});

export type CreateLibraryInput = z.infer<typeof createLibrarySchema>;
export type UpdateLibraryInput = z.infer<typeof updateLibrarySchema>;
