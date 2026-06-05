import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding...");

  // ===== Clear Existing Data =====
  await prisma.clip.deleteMany({});
  await prisma.track.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.workspaceMember.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});

  // ===== Data Seeding =====
  // Responsibility: สร้าง Hash รหัสผ่านตั้งต้นด้วย Argon2 เพื่อใช้กับ User ทดสอบ
  const passwordHash = await argon2.hash("password123");

  // สร้าง User 2 คน
  const user1 = await prisma.user.create({
    data: {
      email: "alice@example.com",
      name: "Alice Creator",
      password_hash: passwordHash,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "bob@example.com",
      name: "Bob Editor",
      password_hash: passwordHash,
    },
  });

  // 3. สร้าง Workspace พร้อมเพิ่ม Member
  const workspace = await prisma.workspace.create({
    data: {
      name: "Alice Studio",
      slug: "alice-studio",
      plan: "pro",
      owner_id: user1.id,
      members: {
        create: [
          { user_id: user1.id, role: "owner" },
          { user_id: user2.id, role: "editor" },
        ],
      },
    },
  });

  // สร้าง Project
  const project = await prisma.project.create({
    data: {
      workspace_id: workspace.id,
      name: "Summer Vlog 2026",
      created_by: user1.id,
      settings: { resolution: "1080p", fps: 60, aspect_ratio: "16:9" },
    },
  });

  // สร้าง Asset สมมติ (ไฟล์วิดีโอต้นฉบับ)
  const asset = await prisma.asset.create({
    data: {
      project_id: project.id,
      upload_by: user1.id,
      type: "video",
      original_url: "s3://cloudcut/mock-video.mp4",
      status: "ready",
      metadata: { duration_ms: 60000, width: 1920, height: 1080 },
    },
  });

  // สร้าง Tracks
  const videoTrack1 = await prisma.track.create({
    data: {
      project_id: project.id,
      type: "video",
      label: "V1",
      order_index: 1,
      color: "#3b82f6",
    },
  });
  const audioTrack1 = await prisma.track.create({
    data: {
      project_id: project.id,
      type: "audio",
      label: "A1",
      order_index: 2,
      color: "#10b981",
    },
  });

  // สร้าง Clips โยนลง Track
  await prisma.clip.createMany({
    data: [
      {
        project_id: project.id,
        track_id: videoTrack1.id,
        asset_id: asset.id,
        name: "Intro Video",
        track_position_ms: 0,
        in_point_ms: 0,
        out_point_ms: 5000,
        duration_ms: 5000,
      },
      {
        project_id: project.id,
        track_id: audioTrack1.id,
        asset_id: asset.id,
        name: "BG Music",
        track_position_ms: 0,
        in_point_ms: 0,
        out_point_ms: 15000,
        duration_ms: 15000,
      },
    ],
  });

  console.log("Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
