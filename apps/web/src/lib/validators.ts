import { z } from "zod";

export const createLibrarySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["book", "comic", "manga"]),
  scanPaths: z
    .array(z.string().min(1))
    .min(1, "At least one scan path is required"),
  scanInterval: z.number().int().min(1).default(30),
});

export const updateLibrarySchema = createLibrarySchema.partial().extend({
  id: z.number().int(),
});

export type CreateLibraryInput = z.infer<typeof createLibrarySchema>;
export type UpdateLibraryInput = z.infer<typeof updateLibrarySchema>;
