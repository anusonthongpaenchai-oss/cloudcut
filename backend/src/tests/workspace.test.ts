import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { workspaceRoutes } from "../feature/workspaces/workspace.routes.js";

import { db } from "../config/db.js";

describe("Workspace API Endpoints", () => {
  let app: FastifyInstance;

  // Mock ข้อมูลสำหรับใช้ข้าม Test
  let workspaceId: string;
  let mockOwnerId = "user-123-vitest";
  let mockFriendId = "user-456-vitest";

  beforeAll(async () => {
    // สร้าง Mock User ลง Database ก่อน
    await db.user.upsert({
      where: { id: mockOwnerId },
      update: {},
      create: {
        id: mockOwnerId,
        email: "owner-vitest@example.com",
        name: "Mock Owner",
        password_hash: "hashed-password",
      },
    });

    await db.user.upsert({
      where: { id: mockFriendId },
      update: {},
      create: {
        id: mockFriendId,
        email: "friend-vitest@example.com",
        name: "Mock Friend",
        password_hash: "hashed-password",
      },
    });

    app = Fastify();

    // Mock Auth Middleware (จำลองการล็อกอิน)
    app.decorateRequest("user", null as any);
    app.decorateRequest("jwtVerify", async function () {
      return; // จำลองว่า JWT ถูกต้องเสมอ
    });
    app.addHook("onRequest", async (request) => {
      // อ่าน Header 'x-mock-user-id' เพื่อจำลองว่าเป็นใครล็อกอินเข้ามา
      const userId = (request.headers["x-mock-user-id"] as string) || mockOwnerId;
      request.user = { id: userId, email: "mock@example.com" };
    });

    // Register Test
    await app.register(workspaceRoutes, { prefix: "/workspaces" });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    // ทำความสะอาด Database
    await db.workspaceMember.deleteMany({
      where: { user_id: { in: [mockOwnerId, mockFriendId] } },
    });
    await db.workspace.deleteMany({
      where: { owner_id: { in: [mockOwnerId, mockFriendId] } },
    });
    await db.user.deleteMany({
      where: { id: { in: [mockOwnerId, mockFriendId] } },
    });
  });

  // ===== 1. เทสการสร้าง Workspace =====
  it("should create a new workspace", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: { "x-mock-user-id": mockOwnerId },
      payload: { name: "Test Vitest Workspace" },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 201) console.log("ERROR:", body);

    expect(response.statusCode).toBe(201);
    expect(body.workspace.name).toBe("Test Vitest Workspace");
    expect(body.workspace.owner_id).toBe(mockOwnerId);

    // เก็บ ID ไว้ใช้เทสข้อต่อไป
    workspaceId = body.workspace.id;
  });

  // ===== 2. เทสดึงข้อมูล Workspace =====
  it("should get a list of workspaces for the current user", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/workspaces",
      headers: { "x-mock-user-id": mockOwnerId },
    });

    const body = JSON.parse(response.payload);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(body.workspaces)).toBe(true);
    // ต้องเจอ Workspace ที่เพิ่งสร้างไปตะกี้
    expect(body.workspaces.some((w: any) => w.id === workspaceId)).toBe(true);
  });

  // ===== 3. เทส RBAC (ระบบเช็กสิทธิ์) - ลองเชิญคนโดยใช้สิทธิ์ Viewer =====
  it("should block inviting members if user does not have owner/admin role", async () => {
    // สมมติว่า mockFriendId เป็นแค่ viewer (หรือยังไม่ได้อยู่ใน Workspace)
    // แล้วพยายามจะไปกดเชิญคนอื่น
    const response = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/invite`,
      headers: { "x-mock-user-id": mockFriendId },
      payload: { email: "hacker@example.com", role: "editor" },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe("Forbidden");
    // แปลว่า Middleware RBAC ทำงานได้ยอดเยี่ยม! ดักคนไม่มีสิทธิ์ไว้ได้
  });

  // ===== 4. เทส Zod Validation - ส่ง Role ผิด =====
  it("should return 400 Bad Request if role is invalid", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/invite`,
      headers: { "x-mock-user-id": mockOwnerId }, // Owner เชิญเอง
      payload: { email: "friend@example.com", role: "superadmin" }, // Role ผิด!
    });

    expect(response.statusCode).toBe(400);
    // แปลว่าด่านตรวจ Zod ป้องกันข้อมูลขยะได้จริง
  });
});
