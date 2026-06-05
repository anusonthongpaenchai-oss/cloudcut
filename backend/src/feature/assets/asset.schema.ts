import { z } from "zod";

// ===== 1. ขอ Presigned URL (POST /assets/presigned-url) =====
export const presignedUrlSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().min(1, "Content type is required"),
  sizeBytes: z.number().positive().optional(),
});

// ===== 2. ยืนยันการอัปโหลด (POST /assets/confirm-upload) =====
export const confirmUploadSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  assetKey: z.string().min(1, "Asset key is required"),
  type: z.enum(["video", "audio", "image"], {
    message: "Invalid asset type",
  }),
});

// ===== 3. ดูรายการ Asset (GET /assets) =====
export const listAssetsSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
