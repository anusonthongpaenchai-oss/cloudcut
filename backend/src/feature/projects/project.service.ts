import { db } from "../../config/db.js";
import { DEFAULT_PROJECT_SETTINGS } from "./project.schema.js";
import type { Prisma } from "@prisma/client";

// ===== Type Definitions =====
type Role = "owner" | "admin" | "editor" | "viewer";

export class ProjectService {
  // ===== 1. สร้าง Project ใหม่ =====
  // Responsibility: ตรวจสอบสิทธิ์ใน workspace แล้วสร้าง project ใหม่พร้อม merge settings default
  static async createProject(input: {
    name: string;
    description: string | undefined;
    workspaceId: string;
    userId: string;
    settings: { resolution?: string | undefined; fps?: number | undefined; duration_ms?: number | undefined } | undefined;
  }) {
    const { name, description, workspaceId, userId, settings } = input;

    // เช็กว่า user เป็นสมาชิกของ workspace นี้ และมีสิทธิ์ editor ขึ้นไป
    const member = await db.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
      },
    });

    if (!member) {
      throw new Error("Forbidden: You are not a member of this workspace");
    }

    const allowedRoles: Role[] = ["owner", "admin", "editor"];
    if (!allowedRoles.includes(member.role as Role)) {
      throw new Error("Forbidden: Insufficient permissions to create a project");
    }

    // merge settings ที่ user ส่งมากับ default
    const mergedSettings = {
      ...DEFAULT_PROJECT_SETTINGS,
      ...(settings ?? {}),
    } satisfies Prisma.InputJsonValue;

    return db.project.create({
      data: {
        name,
        // description เป็น optional → ส่ง null แทน undefined เพราะ Prisma ต้องการ string | null
        description: description ?? null,
        workspace_id: workspaceId,
        created_by: userId,
        settings: mergedSettings,
      },
    });
  }

  // ===== 2. ดึงรายการ Project แบบ Cursor Pagination =====
  // Responsibility: ดึง project ใน workspace โดยใช้ composite cursor (updated_at + id)
  // เพื่อแก้ปัญหา tie-breaking กรณีที่หลาย project มี updated_at เหมือนกัน
  static async listProjects(input: {
    workspaceId: string;
    userId: string;
    cursor: string | undefined;
    limit: number;
  }) {
    const { workspaceId, userId, cursor, limit = 20 } = input;

    // เช็กว่า user เป็นสมาชิกของ workspace นี้ (viewer ขึ้นไปดูได้)
    const member = await db.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
      },
    });

    if (!member) {
      throw new Error("Forbidden: You are not a member of this workspace");
    }

    // decode cursor จาก base64 → JSON → { updated_at, id }
    let cursorDate: Date | null = null;
    let cursorId: string | null = null;

    if (cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(cursor, "base64").toString("utf-8"),
        ) as { updated_at: string; id: string };
        cursorDate = new Date(decoded.updated_at);
        cursorId = decoded.id;
      } catch {
        throw new Error("Invalid cursor format");
      }
    }

    // สร้าง where condition สำหรับ cursor pagination
    // Logic: ดึงโปรเจกต์ที่ updated_at น้อยกว่า cursor
    //        หรือ updated_at เท่ากันแต่ id น้อยกว่า (tie-breaking)
    const whereCondition: Prisma.ProjectWhereInput = {
      workspace_id: workspaceId,
      deleted_at: null,
      ...(cursorDate !== null && cursorId !== null
        ? {
            OR: [
              { updated_at: { lt: cursorDate } },
              { updated_at: { equals: cursorDate }, id: { lt: cursorId } },
            ],
          }
        : {}),
    };

    // ดึง limit + 1 เพื่อตรวจสอบว่ามี next page หรือไม่
    const projects = await db.project.findMany({
      where: whereCondition,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = projects.length > limit;
    const result = hasMore ? projects.slice(0, limit) : projects;

    // encode cursor ของ record สุดท้าย
    let nextCursor: string | null = null;
    const lastItem = result.at(-1);
    if (hasMore && lastItem) {
      nextCursor = Buffer.from(
        JSON.stringify({
          updated_at: lastItem.updated_at.toISOString(),
          id: lastItem.id,
        }),
      ).toString("base64");
    }

    return { projects: result, nextCursor, hasMore };
  }

  // ===== 3. ดึง Project พร้อม Full Timeline =====
  // Responsibility: ดึงข้อมูล project ครบทุกชั้น สำหรับใช้ใน video editor
  static async getProjectById(input: { projectId: string }) {
    const { projectId } = input;

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        tracks: {
          orderBy: { order_index: "asc" },
          include: {
            clips: {
              where: { deleted_at: null },
              orderBy: { track_position_ms: "asc" },
              include: {
                effects: { orderBy: { order_index: "asc" } },
              },
            },
          },
        },
        transitions: true,
        text_overlays: true,
      },
    });

    if (!project || project.deleted_at) {
      throw new Error("Not Found: Project not found");
    }

    return project;
  }

  // ===== 4. อัปเดต Project =====
  static async updateProject(input: {
    projectId: string;
    data: {
      name: string | undefined;
      description: string | undefined;
      settings: Record<string, unknown> | undefined;
    };
  }) {
    const { projectId, data } = input;

    // สร้าง update payload ที่เข้ากันได้กับ Prisma exactOptionalPropertyTypes
    const updateData: Prisma.ProjectUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.settings !== undefined)
      updateData.settings = data.settings as Prisma.InputJsonValue;

    return db.project.update({
      where: { id: projectId },
      data: updateData,
    });
  }

  // ===== 5. Soft Delete Project =====
  // Responsibility: ไม่ลบออกจาก DB จริง แต่ set deleted_at เพื่อ audit trail
  static async softDeleteProject(input: { projectId: string }) {
    const { projectId } = input;

    await db.project.update({
      where: { id: projectId },
      data: { deleted_at: new Date() },
    });
  }

  // ===== 6. Duplicate Project =====
  // Responsibility: คัดลอก project ทั้งหมดพร้อม tracks, clips, effects, transitions, text_overlays
  // ใช้ interactive transaction เพื่อให้ทุก operation สำเร็จหรือ rollback พร้อมกัน
  static async duplicateProject(input: { projectId: string; userId: string }) {
    const { projectId, userId } = input;

    return db.$transaction(async (tx) => {
      // Step 1: ดึง source project พร้อมทุก relation
      const source = await tx.project.findUnique({
        where: { id: projectId },
        include: {
          tracks: {
            include: {
              clips: {
                where: { deleted_at: null },
                include: { effects: true },
              },
            },
          },
          transitions: true,
          text_overlays: true,
        },
      });

      if (!source || source.deleted_at) {
        throw new Error("Not Found: Source project not found");
      }

      // Step 2: สร้าง project ใหม่ ใส่ timestamp เพื่อป้องกันชื่อซ้ำ
      const now = new Date();
      const timestamp = now.toLocaleString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const newProject = await tx.project.create({
        data: {
          name: `Copy of ${source.name} - ${timestamp}`,
          description: source.description ?? null,
          workspace_id: source.workspace_id,
          created_by: userId,
          settings: source.settings as Prisma.InputJsonValue,
        },
      });

      // Step 3: สร้าง tracks ใหม่ และเก็บ map: oldTrackId → newTrackId
      const trackIdMap = new Map<string, string>();

      for (const track of source.tracks) {
        const newTrack = await tx.track.create({
          data: {
            project_id: newProject.id,
            type: track.type,
            label: track.label,
            order_index: track.order_index,
            is_locked: track.is_locked,
            is_muted: track.is_muted,
            color: track.color,
          },
        });
        trackIdMap.set(track.id, newTrack.id);
      }

      // Step 4: สร้าง clips ใหม่ และเก็บ map: oldClipId → newClipId
      // ต้องแปลง track_id ด้วย trackIdMap ที่สร้างไว้
      const clipIdMap = new Map<string, string>();

      for (const track of source.tracks) {
        const newTrackId = trackIdMap.get(track.id);
        if (!newTrackId) continue;

        for (const clip of track.clips) {
          const newClip = await tx.clip.create({
            data: {
              project_id: newProject.id,
              track_id: newTrackId,
              asset_id: clip.asset_id,
              name: clip.name,
              track_position_ms: clip.track_position_ms,
              in_point_ms: clip.in_point_ms,
              out_point_ms: clip.out_point_ms,
              duration_ms: clip.duration_ms,
              transform: clip.transform as Prisma.InputJsonValue,
            },
          });
          clipIdMap.set(clip.id, newClip.id);

          // Step 5: สร้าง effects ของแต่ละ clip
          for (const effect of clip.effects) {
            await tx.clipEffect.create({
              data: {
                clip_id: newClip.id,
                type: effect.type,
                order_index: effect.order_index,
                params: effect.params as Prisma.InputJsonValue,
                enabled: effect.enabled,
              },
            });
          }
        }
      }

      // Step 6: สร้าง transitions โดยแปลง from/to clip IDs ด้วย clipIdMap
      for (const transition of source.transitions) {
        const newFromClipId = clipIdMap.get(transition.from_clip_id);
        const newToClipId = clipIdMap.get(transition.to_clip_id);

        // ถ้า clip ฝั่งใดฝั่งหนึ่งถูก delete ไปแล้ว ข้ามไป
        if (!newFromClipId || !newToClipId) continue;

        await tx.transition.create({
          data: {
            project_id: newProject.id,
            from_clip_id: newFromClipId,
            to_clip_id: newToClipId,
            type: transition.type,
            duration_ms: transition.duration_ms,
            params: (transition.params ?? {}) as Prisma.InputJsonValue,
          },
        });
      }

      // Step 7: สร้าง text overlays
      for (const overlay of source.text_overlays) {
        await tx.textOverlay.create({
          data: {
            project_id: newProject.id,
            track_position_ms: overlay.track_position_ms,
            duration_ms: overlay.duration_ms,
            content: overlay.content,
            font_family: overlay.font_family,
            font_size: overlay.font_size,
            text_color: overlay.text_color,
            position: overlay.position as Prisma.InputJsonValue,
            alignment: overlay.alignment,
            background_color: overlay.background_color ?? null,
            background_opacity: overlay.background_opacity ?? null,
            animation: overlay.animation,
          },
        });
      }

      return newProject;
    });
  }

  // ===== 7. ดึง Version History (OperationLogs) =====
  static async getVersions(input: { projectId: string }) {
    const { projectId } = input;

    return db.operationLog.findMany({
      where: { project_id: projectId },
      orderBy: { server_seq: "asc" },
    });
  }

  // ===== 8. บันทึก Operation Log เป็น Version ใหม่ =====
  static async createVersion(input: {
    projectId: string;
    userId: string;
    operation_type: string;
    payload: Record<string, unknown>;
    client_seq: number;
  }) {
    const { projectId, userId, operation_type, payload, client_seq } = input;

    return db.operationLog.create({
      data: {
        project_id: projectId,
        user_id: userId,
        operation_type,
        payload: payload as Prisma.InputJsonValue,
        client_seq,
      },
    });
  }
}
