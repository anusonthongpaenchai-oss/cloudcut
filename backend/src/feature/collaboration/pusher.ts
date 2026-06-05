import type { FastifyRequest, FastifyReply } from "fastify";
import { pusher } from "../../lib/pusher.js";
import { db } from "../../config/db.js";
import { CollaborationPresence } from "./presence.js";

// ===== Pusher Auth Controller =====
// Responsibility: ยืนยันตัวตนการเข้าถึง channel ของ Pusher
export class CollaborationPusherController {
  static async auth(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { socket_id, channel_name } = request.body as {
        socket_id: string;
        channel_name: string;
      };

      if (!socket_id || !channel_name) {
        return reply
          .status(400)
          .send({ error: "Missing socket_id or channel_name" });
      }

      const userId = request.user.id;

      // ค้นหา projectId จากชื่อ channel
      const isPresence = channel_name.startsWith("presence-project-");
      const isPrivate = channel_name.startsWith("private-project-");

      if (!isPresence && !isPrivate) {
        return reply
          .status(403)
          .send({ error: "Forbidden: Invalid channel format" });
      }

      const projectId = channel_name
        .replace("presence-project-", "")
        .replace("private-project-", "");

      // ตรวจสอบสิทธิ์ว่า user อยู่ใน workspace ของ project นี้หรือไม่
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { workspace_id: true, deleted_at: true },
      });

      if (!project || project.deleted_at) {
        return reply
          .status(404)
          .send({ error: "Not Found: Project not found" });
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
        return reply
          .status(403)
          .send({ error: "Forbidden: You are not a member of this workspace" });
      }

      // ถ้าเป็น presence channel ต้องแนบข้อมูล user กลับไปด้วย
      if (isPresence) {
        const presenceData =
          await CollaborationPresence.buildPresenceData(userId);
        const authResponse = pusher.authorizeChannel(
          socket_id,
          channel_name,
          presenceData,
        );
        return reply.send(authResponse);
      } else {
        const authResponse = pusher.authorizeChannel(socket_id, channel_name);
        return reply.send(authResponse);
      }
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }
}
