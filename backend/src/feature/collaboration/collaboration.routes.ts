import type { FastifyInstance } from "fastify";
import { authExtractor } from "../../middlewares/auth.middleware.js";
import { requireProjectRole } from "../../middlewares/project.middleware.js";
import { CollaborationPusherController } from "./pusher.js";
import { CollaborationSyncController } from "./sync.js";

// ===== Collaboration Routes =====
// Responsibility: จัดการเส้นทางที่เกี่ยวกับการทำ Real-time Collaboration ทั้งหมด
export const collaborationRoutes = async (fastify: FastifyInstance) => {
  // บังคับให้ตรวจสอบ JWT สำหรับทุก route ใน plugin นี้
  fastify.addHook("preHandler", authExtractor);

  // POST /pusher/auth - ยืนยันสิทธิ์ Pusher Channel
  fastify.post("/pusher/auth", CollaborationPusherController.auth);

  // GET /projects/:id/operations - ดึง history เอาไว้ sync ตอน offline
  fastify.get<{ Params: { id: string }; Querystring: { afterSeq?: string } }>(
    "/projects/:id/operations",
    {
      preHandler: [requireProjectRole(["owner", "admin", "editor", "viewer"])],
    },
    CollaborationSyncController.getOperations,
  );
};
