import type { FastifyReply, FastifyRequest } from "fastify";
import { TimelineService } from "./timeline.service.js";
import { BadRequestError } from "../../lib/errors.js";
import {
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

// ===== Timeline Controller =====
// Responsibility: รับ request → validate ด้วย Zod → เรียก Service → return result
// Error handling ทำโดย centralized error handler ใน main.ts (throw แทน try/catch)

export class TimelineController {
  // ============================================================
  // TRACKS
  // ============================================================

  // POST /projects/:id/tracks
  static async createTrack(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createTrackSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId } = request.params as { id: string };
    const userId = request.user.id;

    const track = await TimelineService.createTrack({ projectId, userId, ...parsed.data });
    return reply.status(201).send({ message: "Track created successfully", track });
  }

  // PATCH /projects/:id/tracks/:trackId
  static async updateTrack(request: FastifyRequest, reply: FastifyReply) {
    const parsed = updateTrackSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId, trackId } = request.params as { id: string; trackId: string };
    const userId = request.user.id;

    const track = await TimelineService.updateTrack({ projectId, trackId, userId, ...parsed.data });
    return reply.status(200).send({ message: "Track updated successfully", track });
  }

  // DELETE /projects/:id/tracks/:trackId
  static async deleteTrack(request: FastifyRequest, reply: FastifyReply) {
    const { id: projectId, trackId } = request.params as { id: string; trackId: string };
    const userId = request.user.id;

    const result = await TimelineService.deleteTrack({ projectId, trackId, userId });
    return reply.status(200).send({ message: "Track deleted successfully", ...result });
  }

  // ============================================================
  // CLIPS
  // ============================================================

  // POST /projects/:id/clips
  static async createClip(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createClipSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId } = request.params as { id: string };
    const userId = request.user.id;

    const clip = await TimelineService.createClip({ projectId, userId, ...parsed.data });
    return reply.status(201).send({ message: "Clip created successfully", clip });
  }

  // PATCH /projects/:id/clips/:clipId
  static async updateClip(request: FastifyRequest, reply: FastifyReply) {
    const parsed = updateClipSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId, clipId } = request.params as { id: string; clipId: string };
    const userId = request.user.id;

    const clip = await TimelineService.updateClip({ projectId, clipId, userId, ...parsed.data });
    return reply.status(200).send({ message: "Clip updated successfully", clip });
  }

  // DELETE /projects/:id/clips/:clipId
  static async deleteClip(request: FastifyRequest, reply: FastifyReply) {
    const { id: projectId, clipId } = request.params as { id: string; clipId: string };
    const userId = request.user.id;

    const result = await TimelineService.deleteClip({ projectId, clipId, userId });
    return reply.status(200).send({ message: "Clip deleted successfully", ...result });
  }

  // POST /projects/:id/clips/:clipId/split
  static async splitClip(request: FastifyRequest, reply: FastifyReply) {
    const parsed = splitClipSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId, clipId } = request.params as { id: string; clipId: string };
    const userId = request.user.id;

    const result = await TimelineService.splitClip({ projectId, clipId, userId, ...parsed.data });
    return reply.status(201).send({ message: "Clip split successfully", ...result });
  }

  // POST /projects/:id/clips/batch
  static async batchCreateClips(request: FastifyRequest, reply: FastifyReply) {
    const parsed = batchCreateClipsSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId } = request.params as { id: string };
    const userId = request.user.id;

    const result = await TimelineService.batchCreateClips({ projectId, userId, ...parsed.data });
    return reply.status(201).send({ message: `${result.clips.length} clips created successfully`, ...result });
  }

  // ============================================================
  // EFFECTS
  // ============================================================

  // POST /projects/:id/clips/:clipId/effects
  static async createEffect(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createEffectSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId, clipId } = request.params as { id: string; clipId: string };
    const userId = request.user.id;

    const effect = await TimelineService.createEffect({ projectId, clipId, userId, ...parsed.data });
    return reply.status(201).send({ message: "Effect created successfully", effect });
  }

  // PATCH /projects/:id/clips/:clipId/effects/:effectId
  static async updateEffect(request: FastifyRequest, reply: FastifyReply) {
    const parsed = updateEffectSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId, clipId, effectId } = request.params as {
      id: string;
      clipId: string;
      effectId: string;
    };
    const userId = request.user.id;

    const effect = await TimelineService.updateEffect({ projectId, clipId, effectId, userId, ...parsed.data });
    return reply.status(200).send({ message: "Effect updated successfully", effect });
  }

  // DELETE /projects/:id/clips/:clipId/effects/:effectId
  static async deleteEffect(request: FastifyRequest, reply: FastifyReply) {
    const { id: projectId, clipId, effectId } = request.params as {
      id: string;
      clipId: string;
      effectId: string;
    };
    const userId = request.user.id;

    const result = await TimelineService.deleteEffect({ projectId, clipId, effectId, userId });
    return reply.status(200).send({ message: "Effect deleted successfully", ...result });
  }

  // PATCH /projects/:id/clips/:clipId/effects/reorder
  static async reorderEffects(request: FastifyRequest, reply: FastifyReply) {
    const parsed = reorderEffectsSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId, clipId } = request.params as { id: string; clipId: string };
    const userId = request.user.id;

    const result = await TimelineService.reorderEffects({ projectId, clipId, userId, ...parsed.data });
    return reply.status(200).send({ message: "Effects reordered successfully", ...result });
  }

  // ============================================================
  // TRANSITIONS
  // ============================================================

  // POST /projects/:id/transitions
  static async createTransition(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createTransitionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId } = request.params as { id: string };
    const userId = request.user.id;

    const transition = await TimelineService.createTransition({ projectId, userId, ...parsed.data });
    return reply.status(201).send({ message: "Transition created successfully", transition });
  }

  // PATCH /projects/:id/transitions/:transitionId
  static async updateTransition(request: FastifyRequest, reply: FastifyReply) {
    const parsed = updateTransitionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId, transitionId } = request.params as { id: string; transitionId: string };
    const userId = request.user.id;

    const transition = await TimelineService.updateTransition({ projectId, transitionId, userId, ...parsed.data });
    return reply.status(200).send({ message: "Transition updated successfully", transition });
  }

  // DELETE /projects/:id/transitions/:transitionId
  static async deleteTransition(request: FastifyRequest, reply: FastifyReply) {
    const { id: projectId, transitionId } = request.params as { id: string; transitionId: string };
    const userId = request.user.id;

    const result = await TimelineService.deleteTransition({ projectId, transitionId, userId });
    return reply.status(200).send({ message: "Transition deleted successfully", ...result });
  }

  // ============================================================
  // TEXT OVERLAYS
  // ============================================================

  // POST /projects/:id/text-overlays
  static async createTextOverlay(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createTextOverlaySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId } = request.params as { id: string };
    const userId = request.user.id;

    const overlay = await TimelineService.createTextOverlay({ projectId, userId, ...parsed.data });
    return reply.status(201).send({ message: "Text overlay created successfully", overlay });
  }

  // PATCH /projects/:id/text-overlays/:overlayId
  static async updateTextOverlay(request: FastifyRequest, reply: FastifyReply) {
    const parsed = updateTextOverlaySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { id: projectId, overlayId } = request.params as { id: string; overlayId: string };
    const userId = request.user.id;

    const overlay = await TimelineService.updateTextOverlay({ projectId, overlayId, userId, ...parsed.data });
    return reply.status(200).send({ message: "Text overlay updated successfully", overlay });
  }

  // DELETE /projects/:id/text-overlays/:overlayId
  static async deleteTextOverlay(request: FastifyRequest, reply: FastifyReply) {
    const { id: projectId, overlayId } = request.params as { id: string; overlayId: string };
    const userId = request.user.id;

    const result = await TimelineService.deleteTextOverlay({ projectId, overlayId, userId });
    return reply.status(200).send({ message: "Text overlay deleted successfully", ...result });
  }
}
