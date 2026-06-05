import { S3Client } from "@aws-sdk/client-s3";

// สร้าง Singleton Instance สำหรับ S3Client (MinIO)
export const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
  },
  forcePathStyle: true, // สำคัญมากสำหรับ MinIO เพื่อให้ใช้ path แบบเก่า (domain/bucket/key)
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
