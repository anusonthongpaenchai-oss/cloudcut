import { db } from "../../config/db.js";

// ===== Presence Helper =====
// Responsibility: ดึงข้อมูล user สำหรับ Pusher Presence Channel
export class CollaborationPresence {
  static async buildPresenceData(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar_url: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return {
      user_id: user.id,
      user_info: {
        name: user.name,
        avatar: user.avatar_url,
      },
    };
  }
}
