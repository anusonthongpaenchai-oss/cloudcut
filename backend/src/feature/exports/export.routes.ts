import type { FastifyInstance } from "fastify";
import { authExtractor } from "../../middlewares/auth.middleware.js";
import { requireProjectRole } from "../../middlewares/project.middleware.js";
import { ExportController } from "./export.controller.js";

// ===== Export Routes =====
// Responsibility: กำหนด route ทั้ง 4 ของ Export API
// Register ที่ root level ใน router.ts เพราะมี mixed prefixes:
//   - /projects/:id/exports  (project-scoped)
//   - /exports/:id           (export-scoped)

export const exportRoutes = async (fastify: FastifyInstance) => {
  // ทุก route ต้องผ่าน JWT verification ก่อน
  fastify.addHook("preHandler", authExtractor);

  // ============================================================
  // Project-scoped routes
  // ============================================================

  // POST /projects/:id/exports — สร้าง export job (editor ขึ้นไป)
  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/exports",
    {
      preHandler: [requireProjectRole(["owner", "admin", "editor"])],
    },
    ExportController.createExport,
  );

  // GET /projects/:id/exports — ดูรายการ exports (viewer ขึ้นไป)
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/exports",
    {
      preHandler: [requireProjectRole(["owner", "admin", "editor", "viewer"])],
    },
    ExportController.listExports,
  );

  // ============================================================
  // Export-scoped routes (ไม่มี project prefix)
  // ============================================================

  // GET /exports/:id — ดู progress + download URL
  // (ตรวจสอบสิทธิ์ใน service โดย lookup project จาก export job)
  fastify.get<{ Params: { id: string } }>(
    "/exports/:id",
    ExportController.getExport,
  );

  // DELETE /exports/:id — cancel export job
  // (ตรวจสอบสิทธิ์ใน service: requester หรือ owner/admin)
  fastify.delete<{ Params: { id: string } }>(
    "/exports/:id",
    ExportController.cancelExport,
  );
};
