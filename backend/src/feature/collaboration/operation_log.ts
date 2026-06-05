import { db } from "../../config/db.js";

// ===== Operation Log Repository =====
// Responsibility: จัดการการคิวรีประวัติการอัปเดต (Operations) ของโปรเจกต์
export class CollaborationOperationLog {
  static async getOperationsAfterSeq(projectId: string, afterSeq: number) {
    return await db.operationLog.findMany({
      where: {
        project_id: projectId,
        server_seq: {
          gt: afterSeq,
        },
      },
      orderBy: {
        server_seq: "asc",
      },
    });
  }
}
