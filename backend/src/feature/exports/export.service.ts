import { db } from "../../config/db.js";
import { renderQueue } from "../../lib/queue.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { Prisma } from "@prisma/client";
import type { CreateExportInput, ListExportsQuery } from "./export.schema.js";

// ===== Export Service =====
// Responsibility: จัดการ ExportJob lifecycle ทั้งหมด
//   - สร้าง job + idempotency key + enqueue BullMQ
//   - List jobs แบบ cursor pagination
//   - ดู progress จาก ExportJob table
//   - Cancel job (update DB + try remove จาก queue)

type Role = "owner" | "admin" | "editor" | "viewer";

export class ExportService {
  // ===== Helper: ตรวจสอบสิทธิ์ใน project =====
  private static async checkProjectPermission(
    projectId: string,
    userId: string,
    requiredRoles: Role[],
  ) {
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.deleted_at) {
      throw new NotFoundError("Project not found");
    }

    const member = await db.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: project.workspace_id,
          user_id: userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenError("You are not a member of this workspace");
    }

    if (!requiredRoles.includes(member.role as Role)) {
      throw new ForbiddenError(
        `This action requires one of the following roles: ${requiredRoles.join(", ")}`,
      );
    }

    return { project, member };
  }

  // ===== 1. สร้าง Export Job =====
  // POST /projects/:id/exports
  // Logic: idempotency key → ถ้ามีอยู่แล้ว return 200 + existing job
  static async createExportJob(
    input: { projectId: string; userId: string } & CreateExportInput,
  ) {
    const { projectId, userId, format, resolution, quality } = input;

    // ตรวจสอบสิทธิ์ (editor ขึ้นไปถึงจะ export ได้)
    await this.checkProjectPermission(projectId, userId, [
      "owner",
      "admin",
      "editor",
    ]);

    // สร้าง idempotency key ตาม format: export_{projectId}_{userId}_{timestamp}
    // ใช้ timestamp รายวัน (floor to minute) เพื่อให้ request ภายใน 1 นาทีเดียวกัน
    // ถือว่าเป็น duplicate → ป้องกัน double-click
    const timestamp = Math.floor(Date.now() / 60000); // floor to minute
    const idempotencyKey = `export_${projectId}_${userId}_${timestamp}`;

    // ตรวจสอบว่ามี job ที่มี key นี้อยู่แล้วหรือไม่
    const existing = await db.exportJob.findUnique({
      where: { idempotency_key: idempotencyKey },
    });

    if (existing) {
      // Return existing job พร้อม flag ว่าเป็น idempotent response
      return { job: existing, idempotent: true };
    }

    // สร้าง ExportJob row ใน DB (status: queued)
    const job = await db.exportJob.create({
      data: {
        project_id: projectId,
        request_by: userId,
        format,
        resolution,
        quality,
        status: "queued",
        idempotency_key: idempotencyKey,
      },
    });

    // สร้าง ProcessingJob row ใน DB เพื่อ track
    await db.processingJob.create({
      data: {
        kind: "render_export",
        status: "queued",
        export_job_id: job.id,
        payload: {
          exportJobId: job.id,
          projectId,
          format,
          resolution,
          quality,
        } as Prisma.InputJsonValue,
      },
    });

    // Enqueue ไปยัง BullMQ render-jobs queue
    await renderQueue.add(
      "render_export",
      {
        exportJobId: job.id,
        projectId,
        format,
        resolution,
        quality,
      },
      {
        jobId: `render-export-${job.id}`, // ป้องกัน duplicate job ใน queue
      },
    );

    return { job, idempotent: false };
  }

  // ===== 2. ดูรายการ Export Jobs ใน Project =====
  // GET /projects/:id/exports — cursor pagination
  static async listExportJobs(
    input: { projectId: string; userId: string } & ListExportsQuery,
  ) {
    const { projectId, userId, cursor, limit } = input;

    // ตรวจสอบสิทธิ์ (viewer ขึ้นไปดูได้)
    await this.checkProjectPermission(projectId, userId, [
      "owner",
      "admin",
      "editor",
      "viewer",
    ]);

    // Decode cursor จาก base64
    let cursorDate: Date | null = null;
    let cursorId: string | null = null;

    if (cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(cursor, "base64").toString("utf-8"),
        ) as { created_at: string; id: string };
        cursorDate = new Date(decoded.created_at);
        cursorId = decoded.id;
      } catch {
        throw new NotFoundError("Invalid cursor format");
      }
    }

    const whereCondition: Prisma.ExportJobWhereInput = {
      project_id: projectId,
      ...(cursorDate !== null && cursorId !== null
        ? {
            OR: [
              { created_at: { lt: cursorDate } },
              { created_at: { equals: cursorDate }, id: { lt: cursorId } },
            ],
          }
        : {}),
    };

    const jobs = await db.exportJob.findMany({
      where: whereCondition,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = jobs.length > limit;
    const result = hasMore ? jobs.slice(0, limit) : jobs;

    let nextCursor: string | null = null;
    const lastItem = result.at(-1);
    if (hasMore && lastItem) {
      nextCursor = Buffer.from(
        JSON.stringify({
          created_at: lastItem.created_at.toISOString(),
          id: lastItem.id,
        }),
      ).toString("base64");
    }

    return { jobs: result, nextCursor, hasMore };
  }

  // ===== 3. ดู Export Job Progress =====
  // GET /exports/:id
  static async getExportJob(input: { exportId: string; userId: string }) {
    const { exportId, userId } = input;

    const job = await db.exportJob.findUnique({
      where: { id: exportId },
    });

    if (!job) {
      throw new NotFoundError("Export job not found");
    }

    // ตรวจสอบสิทธิ์: ต้องเป็นสมาชิกของ workspace ที่ project นี้สังกัดอยู่
    await this.checkProjectPermission(job.project_id, userId, [
      "owner",
      "admin",
      "editor",
      "viewer",
    ]);

    return job;
  }

  // ===== 4. Cancel Export Job =====
  // DELETE /exports/:id
  // Authorization:
  //   - requester (request_by) cancel ตัวเองได้เสมอ
  //   - owner/admin cancel ของคนอื่นได้
  static async cancelExportJob(input: { exportId: string; userId: string }) {
    const { exportId, userId } = input;

    const job = await db.exportJob.findUnique({
      where: { id: exportId },
    });

    if (!job) {
      throw new NotFoundError("Export job not found");
    }

    // ดึง member info เพื่อตรวจสอบ role
    const { member } = await this.checkProjectPermission(
      job.project_id,
      userId,
      ["owner", "admin", "editor", "viewer"], // ต้องเป็นสมาชิกก่อน
    );

    // ตรวจสอบ authorization สำหรับ cancel:
    const isRequester = job.request_by === userId;
    const isOwnerOrAdmin =
      member.role === "owner" || member.role === "admin";

    if (!isRequester && !isOwnerOrAdmin) {
      throw new ForbiddenError(
        "You don't have permission to cancel this export job",
      );
    }

    // ตรวจสอบว่า job ยัง cancel ได้ (ไม่ใช่ completed หรือ canceled แล้ว)
    if (job.status === "completed" || job.status === "canceled") {
      throw new ForbiddenError(
        `Cannot cancel a job with status '${job.status}'`,
      );
    }

    // Update status ใน DB เป็น canceled
    const canceled = await db.exportJob.update({
      where: { id: exportId },
      data: {
        status: "canceled",
      },
    });

    // พยายาม remove job จาก BullMQ queue (ถ้ายังอยู่ใน queue)
    try {
      const bullJob = await renderQueue.getJob(`render-export-${exportId}`);
      if (bullJob) {
        await bullJob.remove();
      }
    } catch {
      // ถ้า remove ไม่ได้ (เช่น job กำลัง process อยู่) ก็ไม่เป็นไร
      // worker จะเช็ค DB status เองก่อน process
    }

    return canceled;
  }
}
