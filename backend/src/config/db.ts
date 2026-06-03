import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// ===== Database Instance =====
// Responsibility: สร้าง Connection ไปยัง Postgres ให้อยู่ในสถานะพร้อมใช้งาน (Singleton)

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const db = new PrismaClient({ adapter });
