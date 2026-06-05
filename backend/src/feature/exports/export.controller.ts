import type { FastifyReply, FastifyRequest } from "fastify";
import { ExportService } from "./export.service.js";
import { BadRequestError } from "../../lib/errors.js";
import { createExportSchema, listExportsSchema } from "./export.schema.js";

// ===== Export Controller =====
// Responsibility: รับ request → validate ด้วย Zod → เรียก Service → return result
// Error handling ทำโดย centralized error handler ใน main.ts

export class ExportController {
  // ===== 1. สร้าง Export Job =====
  // POST /projects/:id/exports
  static async createExport(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createExportSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues[0]?.message ?? "Invalid input",
      );
    }

    const { id: projectId } = request.params as { id: string };
    const userId = request.user.id;

    const result = await ExportService.createExportJob({
      projectId,
      userId,
      ...parsed.data,
    });

    // ถ้า idempotent (key ซ้ำ) → return 200 พร้อม existing job
    if (result.idempotent) {
      return reply.status(200).send({
        message: "Export job already exists",
        job: result.job,
        idempotent: true,
      });
    }

    return reply.status(201).send({
      message: "Export job created successfully",
      job: result.job,
      idempotent: false,
    });
  }

  // ===== 2. ดูรายการ Export Jobs ใน Project =====
  // GET /projects/:id/exports
  static async listExports(request: FastifyRequest, reply: FastifyReply) {
    const parsed = listExportsSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues[0]?.message ?? "Invalid query",
      );
    }

    const { id: projectId } = request.params as { id: string };
    const userId = request.user.id;

    const result = await ExportService.listExportJobs({
      projectId,
      userId,
      ...parsed.data,
    });

    return reply.status(200).send(result);
  }

  // ===== 3. ดู Export Job Progress + Download URL =====
  // GET /exports/:id
  static async getExport(request: FastifyRequest, reply: FastifyReply) {
    const { id: exportId } = request.params as { id: string };
    const userId = request.user.id;

    const job = await ExportService.getExportJob({ exportId, userId });

    return reply.status(200).send({ job });
  }

  // ===== 4. Cancel Export Job =====
  // DELETE /exports/:id
  static async cancelExport(request: FastifyRequest, reply: FastifyReply) {
    const { id: exportId } = request.params as { id: string };
    const userId = request.user.id;

    const job = await ExportService.cancelExportJob({ exportId, userId });

    return reply.status(200).send({
      message: "Export job canceled successfully",
      job,
    });
  }
}
