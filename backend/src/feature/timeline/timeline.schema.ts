import { z } from "zod";

// ===== Track Schemas =====

// POST /projects/:id/tracks
export const createTrackSchema = z.object({
  type: z.enum(["video", "audio"], { message: "Track type must be 'video' or 'audio'" }),
  label: z.string().min(1, "Label is required").max(100),
  order_index: z.number().int().min(0, "order_index must be non-negative"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color").optional(),
  is_locked: z.boolean().optional().default(false),
  is_muted: z.boolean().optional().default(false),
});

// PATCH /projects/:id/tracks/:trackId
export const updateTrackSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    order_index: z.number().int().min(0).optional(),
    is_locked: z.boolean().optional(),
    is_muted: z.boolean().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ===== Clip Schemas =====

// POST /projects/:id/clips
export const createClipSchema = z.object({
  trackId: z.string().uuid("Invalid track ID"),
  assetId: z.string().uuid("Invalid asset ID"),
  name: z.string().min(1, "Clip name is required").max(200),
  track_position_ms: z.number().int().min(0, "track_position_ms must be non-negative"),
  in_point_ms: z.number().int().min(0, "in_point_ms must be non-negative"),
  out_point_ms: z.number().int().min(0, "out_point_ms must be non-negative"),
  duration_ms: z.number().int().min(1, "duration_ms must be positive"),
  transform: z.record(z.string(), z.unknown()).optional(),
});

// PATCH /projects/:id/clips/:clipId
export const updateClipSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    track_position_ms: z.number().int().min(0).optional(),
    in_point_ms: z.number().int().min(0).optional(),
    out_point_ms: z.number().int().min(0).optional(),
    duration_ms: z.number().int().min(1).optional(),
    transform: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// POST /projects/:id/clips/:clipId/split
export const splitClipSchema = z.object({
  splitPointMs: z
    .number()
    .int()
    .min(1, "splitPointMs must be positive")
    .describe("จุดตัดแบบ relative จาก in_point ของ clip (หน่วย ms)"),
});

// POST /projects/:id/clips/batch
export const batchCreateClipsSchema = z.object({
  clips: z
    .array(createClipSchema)
    .min(1, "At least one clip is required")
    .max(50, "Cannot batch create more than 50 clips at once"),
});

// ===== Effect Schemas =====

// POST /projects/:id/clips/:clipId/effects
export const createEffectSchema = z.object({
  type: z.enum(["brightness", "contrast", "saturation", "blur"], {
    message: "Invalid effect type",
  }),
  order_index: z.number().int().min(0, "order_index must be non-negative"),
  params: z.record(z.string(), z.unknown()),
  enabled: z.boolean().optional().default(true),
});

// PATCH /projects/:id/clips/:clipId/effects/:effectId
export const updateEffectSchema = z
  .object({
    type: z.enum(["brightness", "contrast", "saturation", "blur"]).optional(),
    order_index: z.number().int().min(0).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// PATCH /projects/:id/clips/:clipId/effects/reorder
export const reorderEffectsSchema = z.object({
  effects: z
    .array(
      z.object({
        effectId: z.string().uuid("Invalid effect ID"),
        order_index: z.number().int().min(0, "order_index must be non-negative"),
      }),
    )
    .min(1, "At least one effect is required"),
});

// ===== Transition Schemas =====

// POST /projects/:id/transitions
export const createTransitionSchema = z.object({
  fromClipId: z.string().uuid("Invalid from clip ID"),
  toClipId: z.string().uuid("Invalid to clip ID"),
  type: z.enum(["dissolve", "wipe_left", "wipe_right", "fade"], {
    message: "Invalid transition type",
  }),
  duration_ms: z.number().int().min(1, "duration_ms must be positive"),
  params: z.record(z.string(), z.unknown()).optional(),
});

// PATCH /projects/:id/transitions/:transitionId
export const updateTransitionSchema = z
  .object({
    type: z.enum(["dissolve", "wipe_left", "wipe_right", "fade"]).optional(),
    duration_ms: z.number().int().min(1).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ===== TextOverlay Schemas =====

// POST /projects/:id/text-overlays
export const createTextOverlaySchema = z.object({
  track_position_ms: z.number().int().min(0),
  duration_ms: z.number().int().min(1),
  content: z.string().min(1, "Content is required").max(1000),
  font_family: z.string().min(1, "Font family is required"),
  font_size: z.number().int().min(1).max(500),
  text_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "text_color must be a valid hex color"),
  position: z.record(z.string(), z.unknown()),
  alignment: z.enum(["left", "center", "right"], {
    message: "alignment must be 'left', 'center', or 'right'",
  }),
  background_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  background_opacity: z.number().min(0).max(1).optional(),
  animation: z.enum(["fade_in", "typewriter", "none"], {
    message: "Invalid animation type",
  }),
});

// PATCH /projects/:id/text-overlays/:overlayId
export const updateTextOverlaySchema = z
  .object({
    track_position_ms: z.number().int().min(0).optional(),
    duration_ms: z.number().int().min(1).optional(),
    content: z.string().min(1).max(1000).optional(),
    font_family: z.string().min(1).optional(),
    font_size: z.number().int().min(1).max(500).optional(),
    text_color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    position: z.record(z.string(), z.unknown()).optional(),
    alignment: z.enum(["left", "center", "right"]).optional(),
    background_color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    background_opacity: z.number().min(0).max(1).optional(),
    animation: z.enum(["fade_in", "typewriter", "none"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
