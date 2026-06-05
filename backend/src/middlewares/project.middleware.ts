import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../config/db.js";
import type { Project, WorkspaceMember } from "@prisma/client";

// ประกาศ Type สำหรับ Role ใน Workspace
type Role = "owner" | "admin" | "editor" | "viewer";

// ขยาย FastifyRequest เพื่อแปะ project และ member context ที่ middleware โหลดไว้
declare module "fastify" {
  interface FastifyRequest {
    project?: Project;
    workspaceMember?: WorkspaceMember;
  }
}

// ===== Project Permission Middleware =====
// Responsibility: ตรวจสอบสิทธิ์การเข้าถึง project แบบ 2 ขั้น
// ขั้น 1: ดึง project → เอา workspace_id มา (เพราะ URL มีแค่ projectId ไม่มี workspaceId)
// ขั้น 2: ตรวจสอบ membership ใน workspace นั้น
export const requireProjectRole = (allowedRoles: Role[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: projectId } = request.params as { id: string };
      const userId = request.user.id;

      if (!projectId) {
        return reply.status(400).send({ error: "Project ID is required" });
      }

      // Step 1: ดึง project เพื่อเอา workspace_id
      const project = await db.project.findUnique({
        where: { id: projectId },
      });

      if (!project || project.deleted_at) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Project not found",
        });
      }

      // Step 2: ตรวจสอบว่า user เป็นสมาชิกของ workspace นั้นหรือไม่
      const member = await db.workspaceMember.findUnique({
        where: {
          workspace_id_user_id: {
            workspace_id: project.workspace_id,
            user_id: userId,
          },
        },
      });

      if (!member) {
        return reply.status(403).send({
          error: "Forbidden",
          message: "You are not a member of this workspace",
        });
      }

      // Step 3: ตรวจสอบว่า role ของ user มีสิทธิ์เพียงพอ
      if (!allowedRoles.includes(member.role as Role)) {
        return reply.status(403).send({
          error: "Forbidden",
          message: `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
        });
      }

      // Step 4: แปะข้อมูลไว้ใน request เพื่อให้ controller นำไปใช้ต่อโดยไม่ต้อง query ซ้ำ
      request.project = project;
      request.workspaceMember = member;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  };
};
