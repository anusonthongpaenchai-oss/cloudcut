import type { Prisma } from "@prisma/client";
import type {
  createTrackSchema,
  updateTrackSchema,
  createClipSchema,
  updateClipSchema,
  splitClipSchema,
  batchCreateClipsSchema,
  createEffectSchema,
  updateEffectSchema,
  reorderEffectsSchema,
  createTransitionSchema,
  updateTransitionSchema,
  createTextOverlaySchema,
  updateTextOverlaySchema,
} from "./timeline.schema.js";
import type { z } from "zod";

// ===== Role Type =====
export type Role = "owner" | "admin" | "editor" | "viewer";

// ===== Inferred Input Types from Zod Schemas =====
export type CreateTrackInput = z.infer<typeof createTrackSchema>;
export type UpdateTrackInput = z.infer<typeof updateTrackSchema>;

export type CreateClipInput = z.infer<typeof createClipSchema>;
export type UpdateClipInput = z.infer<typeof updateClipSchema>;
export type SplitClipInput = z.infer<typeof splitClipSchema>;
export type BatchCreateClipsInput = z.infer<typeof batchCreateClipsSchema>;

export type CreateEffectInput = z.infer<typeof createEffectSchema>;
export type UpdateEffectInput = z.infer<typeof updateEffectSchema>;
export type ReorderEffectsInput = z.infer<typeof reorderEffectsSchema>;

export type CreateTransitionInput = z.infer<typeof createTransitionSchema>;
export type UpdateTransitionInput = z.infer<typeof updateTransitionSchema>;

export type CreateTextOverlayInput = z.infer<typeof createTextOverlaySchema>;
export type UpdateTextOverlayInput = z.infer<typeof updateTextOverlaySchema>;

// ===== Prisma Transaction Type =====
// ใช้สำหรับ type ของ tx ใน service methods
export type PrismaTx = Prisma.TransactionClient;
