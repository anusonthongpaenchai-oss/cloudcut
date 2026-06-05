import type { FastifyRequest, FastifyReply } from "fastify";
import { CollaborationOperationLog } from "./operation_log.js";

// ===== Sync Controller =====
// Responsibility: จัดการการดึงประวัติการอัปเดตสำหรับฝั่ง Client ที่เพิ่งกลับมาออนไลน์ (Offline Reconnect)
export class CollaborationSyncController {
  static async getOperations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: projectId } = request.params as { id: string };
      const { afterSeq } = request.query as { afterSeq?: string };

      const seq = afterSeq ? parseInt(afterSeq, 10) : 0;
      
      if (isNaN(seq)) {
        return reply.status(400).send({ error: "Invalid afterSeq parameter" });
      }

      // ดึง operation ตั้งแต่ seq ที่ขอ
      const logs = await CollaborationOperationLog.getOperationsAfterSeq(projectId, seq);

      // ถ้ารายการตกหล่นมีเยอะเกินไป (มากกว่า 100 รายการ) ให้ Client ไปโหลด state ใหม่ทั้งหมด
      if (logs.length > 100) {
        return reply.send({ tooLarge: true });
      }

      return reply.send({ operations: logs });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }
}
