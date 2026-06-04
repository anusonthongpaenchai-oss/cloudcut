import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../config/db.js";

// ประกาศ Type 
type Role = "owner" | "admin" | "editor" | "viewer";

export const requireWorkspaceRole = (allowedRoles: Role[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 1. ดึง ID ของ Workspace จาก URL (เช่น /workspaces/:id/...)
      const params = request.params as { id?: string; workspaceId?: string };
      const workspaceId = params.id || params.workspaceId;

      // 2. ดึง User ID จากคนที่ล็อกอินอยู่
      const userId = (request.user as any).id;

      if (!workspaceId) {
        return reply.status(400).send({ error: "Workspace ID is required" });
      }

      // 3. ค้นหาในตาราง WorkspaceMember ว่า User คนนี้อยู่ใน Workspace นี้ไหม
      const member = await db.workspaceMember.findUnique({
        where: {
          workspace_id_user_id: {
            workspace_id: workspaceId,
            user_id: userId,
          },
        },
      });

      // 4. ถ้าหาไม่เจอ แปลว่าไม่ได้เป็นสมาชิก
      if (!member) {
        return reply.status(403).send({
          error: "Forbidden",
          message: "You are not a member of this workspace",
        });
      }

      // 5. เช็กว่า Role ของเขา มีอยู่ในรายชื่อที่อนุญาตให้ผ่านไหม
      if (!allowedRoles.includes(member.role as Role)) {
        return reply.status(403).send({
          error: "Forbidden",
          message: `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
        });
      }

      // 6. แปะข้อมูล member ส่งต่อไปให้ Controller ใช้งานต่อ
      (request as any).workspaceMember = member;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  };
};
