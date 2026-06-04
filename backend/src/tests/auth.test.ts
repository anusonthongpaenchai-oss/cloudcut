import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { authRoutes } from "../routes/auth.route.js";
import { db } from "../config/db.js";

// ===== Helper: สร้าง Server จำลองสำหรับ Test =====
const buildTestServer = () => {
  const server = Fastify();
  server.register(fastifyJwt, { secret: "test_secret_key" });
  server.register(authRoutes);

  return server;
};

describe("Auth API Endpoints", () => {
  const app = buildTestServer();

  // สร้างข้อมูลจำลองแบบสุ่ม เพื่อไม่ให้ซ้ำกับการรัน Test ครั้งก่อนๆ
  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = "securepassword123";
  let validAccessToken = "";

  beforeAll(async () => {
    // รอให้ Plugin ทั้งหมดพร้อมใช้งาน
    await app.ready();
  });

  afterAll(async () => {
    // ล้างข้อมูล User ที่สร้างจากการ Test ออกจาก Database
    await db.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  // 1. ทดสอบการสมัครสมาชิก (Register)
  it("should register a new user successfully", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: testEmail,
        name: "Test User",
        password: testPassword,
      },
    });

    expect(response.statusCode).toBe(201);

    const data = response.json();
    expect(data).toHaveProperty("accessToken");
    expect(data).toHaveProperty("refreshToken");
    expect(data.user.email).toBe(testEmail);
  });

  // 2. ทดสอบการเข้าสู่ระบบ (Login)
  it("should login user and return tokens", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(response.statusCode).toBe(200);

    const data = response.json();
    expect(data).toHaveProperty("accessToken");

    // เก็บ Token ไว้ใช้ใน Test ถัดไป
    validAccessToken = data.accessToken;
  });

  // 3. ทดสอบการดึงข้อมูลโปรไฟล์ (Me) แบบมี Token
  it("should get user profile when providing valid access token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${validAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe(testEmail);
  });

  // 4. ทดสอบการบล็อกเมื่อไม่มี Token
  it("should reject access to profile without token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    expect(response.statusCode).toBe(401);
  });
});
