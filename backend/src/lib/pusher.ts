import Pusher from "pusher";

// สร้าง Singleton Instance สำหรับ Pusher
export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "app-id",
  key: process.env.PUSHER_KEY || "app-key",
  secret: process.env.PUSHER_SECRET || "app-secret",
  cluster: process.env.PUSHER_CLUSTER || "ap1",
  useTLS: true,
});
