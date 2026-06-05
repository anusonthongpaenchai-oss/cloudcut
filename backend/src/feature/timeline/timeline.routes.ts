import type { FastifyInstance } from "fastify";
import { requireProjectRole } from "../../middlewares/project.middleware.js";
import { TimelineController } from "./timeline.controller.js";

// ===== Timeline Routes =====
// Responsibility: กำหนด route ทุกเส้นของ Timeline API
// Register เป็น sub-plugin ภายใน project.routes.ts (share prefix /projects)
// ทุก route ต้อง editor ขึ้นไปจึงจะ mutate ได้

export const timelineRoutes = async (fastify: FastifyInstance) => {
  const editorRoles = ["owner", "admin", "editor"] as const;

  // ============================================================
  // TRACKS
  // ============================================================

  // POST /projects/:id/tracks — สร้าง track ใหม่
  fastify.post<{ Params: { id: string } }>(
    "/:id/tracks",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.createTrack,
  );

  // PATCH /projects/:id/tracks/:trackId — แก้ไข track
  fastify.patch<{ Params: { id: string; trackId: string } }>(
    "/:id/tracks/:trackId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.updateTrack,
  );

  // DELETE /projects/:id/tracks/:trackId — ลบ track
  fastify.delete<{ Params: { id: string; trackId: string } }>(
    "/:id/tracks/:trackId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.deleteTrack,
  );

  // ============================================================
  // CLIPS
  // ============================================================

  // POST /projects/:id/clips/batch — batch create clips (ต้องมาก่อน /:id/clips/:clipId/*)
  fastify.post<{ Params: { id: string } }>(
    "/:id/clips/batch",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.batchCreateClips,
  );

  // POST /projects/:id/clips — สร้าง clip ใหม่
  fastify.post<{ Params: { id: string } }>(
    "/:id/clips",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.createClip,
  );

  // PATCH /projects/:id/clips/:clipId — แก้ไข clip
  fastify.patch<{ Params: { id: string; clipId: string } }>(
    "/:id/clips/:clipId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.updateClip,
  );

  // DELETE /projects/:id/clips/:clipId — soft delete clip
  fastify.delete<{ Params: { id: string; clipId: string } }>(
    "/:id/clips/:clipId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.deleteClip,
  );

  // POST /projects/:id/clips/:clipId/split — ตัด clip
  fastify.post<{ Params: { id: string; clipId: string } }>(
    "/:id/clips/:clipId/split",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.splitClip,
  );

  // ============================================================
  // EFFECTS
  // ============================================================

  // PATCH /projects/:id/clips/:clipId/effects/reorder — เรียงลำดับ effects (ต้องมาก่อน /:effectId)
  fastify.patch<{ Params: { id: string; clipId: string } }>(
    "/:id/clips/:clipId/effects/reorder",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.reorderEffects,
  );

  // POST /projects/:id/clips/:clipId/effects — เพิ่ม effect
  fastify.post<{ Params: { id: string; clipId: string } }>(
    "/:id/clips/:clipId/effects",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.createEffect,
  );

  // PATCH /projects/:id/clips/:clipId/effects/:effectId — แก้ไข effect
  fastify.patch<{ Params: { id: string; clipId: string; effectId: string } }>(
    "/:id/clips/:clipId/effects/:effectId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.updateEffect,
  );

  // DELETE /projects/:id/clips/:clipId/effects/:effectId — ลบ effect
  fastify.delete<{ Params: { id: string; clipId: string; effectId: string } }>(
    "/:id/clips/:clipId/effects/:effectId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.deleteEffect,
  );

  // ============================================================
  // TRANSITIONS
  // ============================================================

  // POST /projects/:id/transitions — สร้าง transition
  fastify.post<{ Params: { id: string } }>(
    "/:id/transitions",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.createTransition,
  );

  // PATCH /projects/:id/transitions/:transitionId — แก้ไข transition
  fastify.patch<{ Params: { id: string; transitionId: string } }>(
    "/:id/transitions/:transitionId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.updateTransition,
  );

  // DELETE /projects/:id/transitions/:transitionId — ลบ transition
  fastify.delete<{ Params: { id: string; transitionId: string } }>(
    "/:id/transitions/:transitionId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.deleteTransition,
  );

  // ============================================================
  // TEXT OVERLAYS
  // ============================================================

  // POST /projects/:id/text-overlays — สร้าง text overlay
  fastify.post<{ Params: { id: string } }>(
    "/:id/text-overlays",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.createTextOverlay,
  );

  // PATCH /projects/:id/text-overlays/:overlayId — แก้ไข text overlay
  fastify.patch<{ Params: { id: string; overlayId: string } }>(
    "/:id/text-overlays/:overlayId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.updateTextOverlay,
  );

  // DELETE /projects/:id/text-overlays/:overlayId — ลบ text overlay
  fastify.delete<{ Params: { id: string; overlayId: string } }>(
    "/:id/text-overlays/:overlayId",
    { preHandler: [requireProjectRole([...editorRoles])] },
    TimelineController.deleteTextOverlay,
  );
};
