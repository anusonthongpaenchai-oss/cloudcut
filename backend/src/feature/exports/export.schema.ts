import { z } from "zod";

// ===== 1. สร้าง Export Job (POST /projects/:id/exports) =====
export const createExportSchema = z.object({
  format: z.enum(["mp4", "webm"], {
    message: "format must be 'mp4' or 'webm'",
  }),
  resolution: z.enum(["p720", "p1080", "p4k"], {
    message: "resolution must be 'p720', 'p1080', or 'p4k'",
  }),
  quality: z.enum(["draft", "standard", "high"], {
    message: "quality must be 'draft', 'standard', or 'high'",
  }),
});

// ===== 2. ดูรายการ Export Jobs (GET /projects/:id/exports) =====
export const listExportsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Export TypeScript types
export type CreateExportInput = z.infer<typeof createExportSchema>;
export type ListExportsQuery = z.infer<typeof listExportsSchema>;
