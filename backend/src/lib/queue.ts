import { Queue } from "bullmq";

// ตั้งค่า Redis connection (สามารถดึงจาก env ได้)
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
};

// สร้าง Queue สำหรับ Processing Jobs ตามที่ระบุใน requirements
export const processingQueue = new Queue("processing-jobs", {
  connection,
});
