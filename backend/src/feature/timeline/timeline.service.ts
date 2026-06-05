import { db } from "../../config/db.js";
import { pusher } from "../../lib/pusher.js";
import { ForbiddenError, NotFoundError, BadRequestError } from "../../lib/errors.js";
import type { Prisma } from "@prisma/client";
import type {
  PrismaTx,
  CreateTrackInput,
  UpdateTrackInput,
  CreateClipInput,
  UpdateClipInput,
  SplitClipInput,
  BatchCreateClipsInput,
  CreateEffectInput,
  UpdateEffectInput,
  ReorderEffectsInput,
  CreateTransitionInput,
  UpdateTransitionInput,
  CreateTextOverlayInput,
  UpdateTextOverlayInput,
} from "./timeline.types.js";

// ===== Timeline Service =====
// Responsibility: ทุก mutation ต้องทำครบ 6 ขั้นตอน:
//   1. Validate input (ทำใน controller แล้ว)
//   2. Check permission (ทำโดย middleware แล้ว)
//   3. Execute DB transaction
//   4. Write OperationLog
//   5. Broadcast via Pusher
//   6. Return updated entity

export class TimelineService {
  // ===== Helper: auto-generate client_seq =====
  // ดึง max client_seq ของ project นั้น แล้ว +1 เพื่อ guarantee ordering
  private static async getNextClientSeq(
    tx: PrismaTx,
    projectId: string,
  ): Promise<number> {
    const latest = await tx.operationLog.findFirst({
      where: { project_id: projectId },
      orderBy: { client_seq: "desc" },
      select: { client_seq: true },
    });
    return (latest?.client_seq ?? -1) + 1;
  }

  // ===== Helper: verify project exists =====
  private static async verifyProject(projectId: string) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, deleted_at: true },
    });
    if (!project || project.deleted_at) {
      throw new NotFoundError("Project not found");
    }
  }

  // ============================================================
  // TRACKS
  // ============================================================

  // POST /projects/:id/tracks
  static async createTrack(input: { projectId: string; userId: string } & CreateTrackInput) {
    const { projectId, userId, type, label, order_index, color, is_locked, is_muted } = input;

    await this.verifyProject(projectId);

    return db.$transaction(async (tx) => {
      // Step 3: DB transaction
      const track = await tx.track.create({
        data: {
          project_id: projectId,
          type,
          label,
          order_index,
          color: color ?? "#3B82F6",
          is_locked: is_locked ?? false,
          is_muted: is_muted ?? false,
        },
      });

      // Step 4: Write OperationLog
      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "track.create",
          payload: { trackId: track.id, type, label, order_index } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      // Step 5: Broadcast via Pusher
      await pusher.trigger(`private-project-${projectId}`, "track-updated", {
        action: "create",
        track,
      });

      // Step 6: Return
      return track;
    });
  }

  // PATCH /projects/:id/tracks/:trackId
  static async updateTrack(
    input: { projectId: string; trackId: string; userId: string } & UpdateTrackInput,
  ) {
    const { projectId, trackId, userId, ...fields } = input;

    const track = await db.track.findUnique({ where: { id: trackId } });
    if (!track || track.project_id !== projectId) {
      throw new NotFoundError("Track not found");
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.track.update({
        where: { id: trackId },
        data: fields as Prisma.TrackUpdateInput,
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "track.update",
          payload: { trackId, ...fields } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "track-updated", {
        action: "update",
        track: updated,
      });

      return updated;
    });
  }

  // DELETE /projects/:id/tracks/:trackId
  static async deleteTrack(input: { projectId: string; trackId: string; userId: string }) {
    const { projectId, trackId, userId } = input;

    const track = await db.track.findUnique({ where: { id: trackId } });
    if (!track || track.project_id !== projectId) {
      throw new NotFoundError("Track not found");
    }

    return db.$transaction(async (tx) => {
      // Soft delete clips ใน track ก่อน
      await tx.clip.updateMany({
        where: { track_id: trackId, deleted_at: null },
        data: { deleted_at: new Date() },
      });

      await tx.track.delete({ where: { id: trackId } });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "track.delete",
          payload: { trackId } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "track-updated", {
        action: "delete",
        trackId,
      });

      return { trackId };
    });
  }

  // ============================================================
  // CLIPS
  // ============================================================

  // POST /projects/:id/clips
  static async createClip(input: { projectId: string; userId: string } & CreateClipInput) {
    const {
      projectId,
      userId,
      trackId,
      assetId,
      name,
      track_position_ms,
      in_point_ms,
      out_point_ms,
      duration_ms,
      transform,
    } = input;

    await this.verifyProject(projectId);

    // ตรวจสอบว่า track อยู่ใน project นี้
    const track = await db.track.findUnique({ where: { id: trackId } });
    if (!track || track.project_id !== projectId) {
      throw new NotFoundError("Track not found in this project");
    }

    return db.$transaction(async (tx) => {
      const clip = await tx.clip.create({
        data: {
          project_id: projectId,
          track_id: trackId,
          asset_id: assetId,
          name,
          track_position_ms,
          in_point_ms,
          out_point_ms,
          duration_ms,
          transform: (transform ?? {}) as Prisma.InputJsonValue,
        },
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "clip.create",
          payload: { clipId: clip.id, trackId, name, track_position_ms } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "clip-updated", {
        action: "create",
        clip,
      });

      return clip;
    });
  }

  // PATCH /projects/:id/clips/:clipId
  static async updateClip(
    input: { projectId: string; clipId: string; userId: string } & UpdateClipInput,
  ) {
    const { projectId, clipId, userId, ...fields } = input;

    const clip = await db.clip.findUnique({ where: { id: clipId } });
    if (!clip || clip.project_id !== projectId || clip.deleted_at) {
      throw new NotFoundError("Clip not found");
    }

    return db.$transaction(async (tx) => {
      const updateData: Prisma.ClipUpdateInput = {};
      if (fields.name !== undefined) updateData.name = fields.name;
      if (fields.track_position_ms !== undefined) updateData.track_position_ms = fields.track_position_ms;
      if (fields.in_point_ms !== undefined) updateData.in_point_ms = fields.in_point_ms;
      if (fields.out_point_ms !== undefined) updateData.out_point_ms = fields.out_point_ms;
      if (fields.duration_ms !== undefined) updateData.duration_ms = fields.duration_ms;
      if (fields.transform !== undefined) updateData.transform = fields.transform as Prisma.InputJsonValue;

      const updated = await tx.clip.update({
        where: { id: clipId },
        data: { ...updateData, version: { increment: 1 } },
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "clip.update",
          payload: { clipId, ...fields } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "clip-updated", {
        action: "update",
        clip: updated,
      });

      return updated;
    });
  }

  // DELETE /projects/:id/clips/:clipId (Soft Delete)
  static async deleteClip(input: { projectId: string; clipId: string; userId: string }) {
    const { projectId, clipId, userId } = input;

    const clip = await db.clip.findUnique({ where: { id: clipId } });
    if (!clip || clip.project_id !== projectId || clip.deleted_at) {
      throw new NotFoundError("Clip not found");
    }

    return db.$transaction(async (tx) => {
      await tx.clip.update({
        where: { id: clipId },
        data: { deleted_at: new Date() },
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "clip.delete",
          payload: { clipId } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "clip-updated", {
        action: "delete",
        clipId,
      });

      return { clipId };
    });
  }

  // POST /projects/:id/clips/:clipId/split
  static async splitClip(
    input: { projectId: string; clipId: string; userId: string } & SplitClipInput,
  ) {
    const { projectId, clipId, userId, splitPointMs } = input;

    const original = await db.clip.findUnique({
      where: { id: clipId },
      include: { effects: { orderBy: { order_index: "asc" } } },
    });

    if (!original || original.project_id !== projectId || original.deleted_at) {
      throw new NotFoundError("Clip not found");
    }

    // Validate: splitPointMs ต้องอยู่ภายใน duration ของ clip
    if (splitPointMs >= original.duration_ms || splitPointMs <= 0) {
      throw new BadRequestError(
        `splitPointMs (${splitPointMs}) must be between 1 and ${original.duration_ms - 1}`,
      );
    }

    return db.$transaction(async (tx) => {
      // Step 3a: Update original clip (ตัดส่วนหลังออก)
      const updatedOriginal = await tx.clip.update({
        where: { id: clipId },
        data: {
          out_point_ms: original.in_point_ms + splitPointMs,
          duration_ms: splitPointMs,
          version: { increment: 1 },
        },
      });

      // Step 3b: Create new clip (ส่วนหลัง)
      const newClip = await tx.clip.create({
        data: {
          project_id: projectId,
          track_id: original.track_id,
          asset_id: original.asset_id,
          name: `${original.name} (2)`,
          track_position_ms: original.track_position_ms + splitPointMs,
          in_point_ms: original.in_point_ms + splitPointMs,
          out_point_ms: original.out_point_ms,
          duration_ms: original.duration_ms - splitPointMs,
          transform: (original.transform ?? {}) as Prisma.InputJsonValue,
        },
      });

      // Step 3c: Copy effects ไปยัง clip ใหม่
      if (original.effects.length > 0) {
        await tx.clipEffect.createMany({
          data: original.effects.map((effect) => ({
            clip_id: newClip.id,
            type: effect.type,
            order_index: effect.order_index,
            params: effect.params as Prisma.InputJsonValue,
            enabled: effect.enabled,
          })),
        });
      }

      // Step 4: Write OperationLog
      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "clip.split",
          payload: {
            originalClipId: clipId,
            newClipId: newClip.id,
            splitPointMs,
          } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      // Step 5: Broadcast
      await pusher.trigger(`private-project-${projectId}`, "clip-updated", {
        action: "split",
        originalClip: updatedOriginal,
        newClip,
      });

      // Step 6: Return both clips
      return { originalClip: updatedOriginal, newClip };
    });
  }

  // POST /projects/:id/clips/batch
  static async batchCreateClips(
    input: { projectId: string; userId: string } & BatchCreateClipsInput,
  ) {
    const { projectId, userId, clips } = input;

    await this.verifyProject(projectId);

    // ตรวจสอบว่า track IDs ทั้งหมดอยู่ใน project
    const trackIds = [...new Set(clips.map((c) => c.trackId))];
    const validTracks = await db.track.findMany({
      where: { id: { in: trackIds }, project_id: projectId },
      select: { id: true },
    });
    if (validTracks.length !== trackIds.length) {
      throw new NotFoundError("One or more tracks not found in this project");
    }

    return db.$transaction(async (tx) => {
      // Batch insert clips
      const createdClips = await Promise.all(
        clips.map((clip) =>
          tx.clip.create({
            data: {
              project_id: projectId,
              track_id: clip.trackId,
              asset_id: clip.assetId,
              name: clip.name,
              track_position_ms: clip.track_position_ms,
              in_point_ms: clip.in_point_ms,
              out_point_ms: clip.out_point_ms,
              duration_ms: clip.duration_ms,
              transform: (clip.transform ?? {}) as Prisma.InputJsonValue,
            },
          }),
        ),
      );

      // Step 4: Single OperationLog สำหรับ batch
      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "clip.batch_create",
          payload: {
            count: createdClips.length,
            clipIds: createdClips.map((c) => c.id),
          } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      // Step 5: Single Pusher event สำหรับ batch
      await pusher.trigger(`private-project-${projectId}`, "clip-updated", {
        action: "batch_create",
        clips: createdClips,
      });

      return { clips: createdClips };
    });
  }

  // ============================================================
  // EFFECTS
  // ============================================================

  // POST /projects/:id/clips/:clipId/effects
  static async createEffect(
    input: { projectId: string; clipId: string; userId: string } & CreateEffectInput,
  ) {
    const { projectId, clipId, userId, type, order_index, params, enabled } = input;

    const clip = await db.clip.findUnique({ where: { id: clipId } });
    if (!clip || clip.project_id !== projectId || clip.deleted_at) {
      throw new NotFoundError("Clip not found");
    }

    return db.$transaction(async (tx) => {
      const effect = await tx.clipEffect.create({
        data: {
          clip_id: clipId,
          type,
          order_index,
          params: params as Prisma.InputJsonValue,
          enabled: enabled ?? true,
        },
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "effect.create",
          payload: { effectId: effect.id, clipId, type } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "effect-updated", {
        action: "create",
        effect,
      });

      return effect;
    });
  }

  // PATCH /projects/:id/clips/:clipId/effects/:effectId
  static async updateEffect(
    input: {
      projectId: string;
      clipId: string;
      effectId: string;
      userId: string;
    } & UpdateEffectInput,
  ) {
    const { projectId, clipId, effectId, userId, ...fields } = input;

    const clip = await db.clip.findUnique({ where: { id: clipId } });
    if (!clip || clip.project_id !== projectId || clip.deleted_at) {
      throw new NotFoundError("Clip not found");
    }

    const effect = await db.clipEffect.findUnique({ where: { id: effectId } });
    if (!effect || effect.clip_id !== clipId) {
      throw new NotFoundError("Effect not found");
    }

    return db.$transaction(async (tx) => {
      const updateData: Prisma.ClipEffectUpdateInput = {};
      if (fields.type !== undefined) updateData.type = fields.type;
      if (fields.order_index !== undefined) updateData.order_index = fields.order_index;
      if (fields.params !== undefined) updateData.params = fields.params as Prisma.InputJsonValue;
      if (fields.enabled !== undefined) updateData.enabled = fields.enabled;

      const updated = await tx.clipEffect.update({
        where: { id: effectId },
        data: updateData,
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "effect.update",
          payload: { effectId, clipId, ...fields } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "effect-updated", {
        action: "update",
        effect: updated,
      });

      return updated;
    });
  }

  // DELETE /projects/:id/clips/:clipId/effects/:effectId
  static async deleteEffect(input: {
    projectId: string;
    clipId: string;
    effectId: string;
    userId: string;
  }) {
    const { projectId, clipId, effectId, userId } = input;

    const clip = await db.clip.findUnique({ where: { id: clipId } });
    if (!clip || clip.project_id !== projectId || clip.deleted_at) {
      throw new NotFoundError("Clip not found");
    }

    const effect = await db.clipEffect.findUnique({ where: { id: effectId } });
    if (!effect || effect.clip_id !== clipId) {
      throw new NotFoundError("Effect not found");
    }

    return db.$transaction(async (tx) => {
      await tx.clipEffect.delete({ where: { id: effectId } });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "effect.delete",
          payload: { effectId, clipId } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "effect-updated", {
        action: "delete",
        effectId,
        clipId,
      });

      return { effectId };
    });
  }

  // PATCH /projects/:id/clips/:clipId/effects/reorder
  static async reorderEffects(
    input: { projectId: string; clipId: string; userId: string } & ReorderEffectsInput,
  ) {
    const { projectId, clipId, userId, effects } = input;

    const clip = await db.clip.findUnique({ where: { id: clipId } });
    if (!clip || clip.project_id !== projectId || clip.deleted_at) {
      throw new NotFoundError("Clip not found");
    }

    return db.$transaction(async (tx) => {
      // Update order_index ทุก effect ใน transaction เดียว
      const updated = await Promise.all(
        effects.map(({ effectId, order_index }) =>
          tx.clipEffect.update({
            where: { id: effectId },
            data: { order_index },
          }),
        ),
      );

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "effect.reorder",
          payload: { clipId, effects } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "effect-updated", {
        action: "reorder",
        clipId,
        effects: updated,
      });

      return { effects: updated };
    });
  }

  // ============================================================
  // TRANSITIONS
  // ============================================================

  // POST /projects/:id/transitions
  static async createTransition(
    input: { projectId: string; userId: string } & CreateTransitionInput,
  ) {
    const { projectId, userId, fromClipId, toClipId, type, duration_ms, params } = input;

    await this.verifyProject(projectId);

    // ตรวจสอบว่า from/to clips อยู่ใน project นี้
    const [fromClip, toClip] = await Promise.all([
      db.clip.findUnique({ where: { id: fromClipId } }),
      db.clip.findUnique({ where: { id: toClipId } }),
    ]);

    if (!fromClip || fromClip.project_id !== projectId || fromClip.deleted_at) {
      throw new NotFoundError("fromClip not found in this project");
    }
    if (!toClip || toClip.project_id !== projectId || toClip.deleted_at) {
      throw new NotFoundError("toClip not found in this project");
    }

    return db.$transaction(async (tx) => {
      const transition = await tx.transition.create({
        data: {
          project_id: projectId,
          from_clip_id: fromClipId,
          to_clip_id: toClipId,
          type,
          duration_ms,
          params: (params ?? {}) as Prisma.InputJsonValue,
        },
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "transition.create",
          payload: { transitionId: transition.id, fromClipId, toClipId, type } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "transition-updated", {
        action: "create",
        transition,
      });

      return transition;
    });
  }

  // PATCH /projects/:id/transitions/:transitionId
  static async updateTransition(
    input: {
      projectId: string;
      transitionId: string;
      userId: string;
    } & UpdateTransitionInput,
  ) {
    const { projectId, transitionId, userId, ...fields } = input;

    const transition = await db.transition.findUnique({ where: { id: transitionId } });
    if (!transition || transition.project_id !== projectId) {
      throw new NotFoundError("Transition not found");
    }

    return db.$transaction(async (tx) => {
      const updateData: Prisma.TransitionUpdateInput = {};
      if (fields.type !== undefined) updateData.type = fields.type;
      if (fields.duration_ms !== undefined) updateData.duration_ms = fields.duration_ms;
      if (fields.params !== undefined) updateData.params = fields.params as Prisma.InputJsonValue;

      const updated = await tx.transition.update({
        where: { id: transitionId },
        data: updateData,
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "transition.update",
          payload: { transitionId, ...fields } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "transition-updated", {
        action: "update",
        transition: updated,
      });

      return updated;
    });
  }

  // DELETE /projects/:id/transitions/:transitionId
  static async deleteTransition(input: {
    projectId: string;
    transitionId: string;
    userId: string;
  }) {
    const { projectId, transitionId, userId } = input;

    const transition = await db.transition.findUnique({ where: { id: transitionId } });
    if (!transition || transition.project_id !== projectId) {
      throw new NotFoundError("Transition not found");
    }

    return db.$transaction(async (tx) => {
      await tx.transition.delete({ where: { id: transitionId } });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "transition.delete",
          payload: { transitionId } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "transition-updated", {
        action: "delete",
        transitionId,
      });

      return { transitionId };
    });
  }

  // ============================================================
  // TEXT OVERLAYS
  // ============================================================

  // POST /projects/:id/text-overlays
  static async createTextOverlay(
    input: { projectId: string; userId: string } & CreateTextOverlayInput,
  ) {
    const { projectId, userId, ...data } = input;

    await this.verifyProject(projectId);

    return db.$transaction(async (tx) => {
      const overlay = await tx.textOverlay.create({
        data: {
          project_id: projectId,
          track_position_ms: data.track_position_ms,
          duration_ms: data.duration_ms,
          content: data.content,
          font_family: data.font_family,
          font_size: data.font_size,
          text_color: data.text_color,
          position: data.position as Prisma.InputJsonValue,
          alignment: data.alignment,
          background_color: data.background_color ?? null,
          background_opacity: data.background_opacity ?? null,
          animation: data.animation,
        },
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "text_overlay.create",
          payload: { overlayId: overlay.id, content: data.content } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "text-overlay-updated", {
        action: "create",
        overlay,
      });

      return overlay;
    });
  }

  // PATCH /projects/:id/text-overlays/:overlayId
  static async updateTextOverlay(
    input: {
      projectId: string;
      overlayId: string;
      userId: string;
    } & UpdateTextOverlayInput,
  ) {
    const { projectId, overlayId, userId, ...fields } = input;

    const overlay = await db.textOverlay.findUnique({ where: { id: overlayId } });
    if (!overlay || overlay.project_id !== projectId) {
      throw new NotFoundError("Text overlay not found");
    }

    return db.$transaction(async (tx) => {
      const updateData: Prisma.TextOverlayUpdateInput = {};
      if (fields.track_position_ms !== undefined) updateData.track_position_ms = fields.track_position_ms;
      if (fields.duration_ms !== undefined) updateData.duration_ms = fields.duration_ms;
      if (fields.content !== undefined) updateData.content = fields.content;
      if (fields.font_family !== undefined) updateData.font_family = fields.font_family;
      if (fields.font_size !== undefined) updateData.font_size = fields.font_size;
      if (fields.text_color !== undefined) updateData.text_color = fields.text_color;
      if (fields.position !== undefined) updateData.position = fields.position as Prisma.InputJsonValue;
      if (fields.alignment !== undefined) updateData.alignment = fields.alignment;
      if (fields.background_color !== undefined) updateData.background_color = fields.background_color;
      if (fields.background_opacity !== undefined) updateData.background_opacity = fields.background_opacity;
      if (fields.animation !== undefined) updateData.animation = fields.animation;

      const updated = await tx.textOverlay.update({
        where: { id: overlayId },
        data: updateData,
      });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "text_overlay.update",
          payload: { overlayId, ...fields } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "text-overlay-updated", {
        action: "update",
        overlay: updated,
      });

      return updated;
    });
  }

  // DELETE /projects/:id/text-overlays/:overlayId
  static async deleteTextOverlay(input: {
    projectId: string;
    overlayId: string;
    userId: string;
  }) {
    const { projectId, overlayId, userId } = input;

    const overlay = await db.textOverlay.findUnique({ where: { id: overlayId } });
    if (!overlay || overlay.project_id !== projectId) {
      throw new NotFoundError("Text overlay not found");
    }

    return db.$transaction(async (tx) => {
      await tx.textOverlay.delete({ where: { id: overlayId } });

      const clientSeq = await this.getNextClientSeq(tx, projectId);
      await tx.operationLog.create({
        data: {
          project_id: projectId,
          user_id: userId,
          operation_type: "text_overlay.delete",
          payload: { overlayId } as Prisma.InputJsonValue,
          client_seq: clientSeq,
        },
      });

      await pusher.trigger(`private-project-${projectId}`, "text-overlay-updated", {
        action: "delete",
        overlayId,
      });

      return { overlayId };
    });
  }
}
