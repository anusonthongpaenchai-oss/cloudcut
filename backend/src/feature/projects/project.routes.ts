import type { FastifyInstance } from "fastify";
import { authExtractor } from "../../middlewares/auth.middleware.js";
import { requireProjectRole } from "../../middlewares/project.middleware.js";
import { ProjectController } from "./project.controller.js";

export const projectRoutes = async (fastify: FastifyInstance) => {
  // ทุก route ต้องผ่าน JWT verification ก่อน
  fastify.addHook("preHandler", authExtractor);

  // --- Routes ที่ไม่ต้องการ project middleware (ใช้ workspaceId จาก body/query) ---

  // POST /projects — สร้าง project ใหม่ (เช็กสิทธิ์ใน service)
  fastify.post("/", ProjectController.createProject);

  // GET /projects?workspaceId=X — ดูรายการ project (เช็กสิทธิ์ใน service)
  fastify.get("/", ProjectController.listProjects);

  // --- Routes ที่ต้องการ project middleware (มี :id ใน URL) ---

  // GET /projects/:id — ดู project พร้อม full timeline (viewer ขึ้นไป)
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [requireProjectRole(["owner", "admin", "editor", "viewer"])],
    },
    ProjectController.getProjectById,
  );

  // PATCH /projects/:id — แก้ไข project (editor ขึ้นไป)
  fastify.patch<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [requireProjectRole(["owner", "admin", "editor"])],
    },
    ProjectController.updateProject,
  );

  // DELETE /projects/:id — ลบ project แบบ soft delete (owner/admin เท่านั้น)
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [requireProjectRole(["owner", "admin"])],
    },
    ProjectController.deleteProject,
  );

  // POST /projects/:id/duplicate — คัดลอก project (editor ขึ้นไป)
  fastify.post<{ Params: { id: string } }>(
    "/:id/duplicate",
    {
      preHandler: [requireProjectRole(["owner", "admin", "editor"])],
    },
    ProjectController.duplicateProject,
  );

  // GET /projects/:id/versions — ดู operation history (viewer ขึ้นไป)
  fastify.get<{ Params: { id: string } }>(
    "/:id/versions",
    {
      preHandler: [requireProjectRole(["owner", "admin", "editor", "viewer"])],
    },
    ProjectController.getProjectVersions,
  );

  // POST /projects/:id/versions — บันทึก operation ใหม่ (editor ขึ้นไป)
  fastify.post<{ Params: { id: string } }>(
    "/:id/versions",
    {
      preHandler: [requireProjectRole(["owner", "admin", "editor"])],
    },
    ProjectController.createProjectVersion,
  );
};
