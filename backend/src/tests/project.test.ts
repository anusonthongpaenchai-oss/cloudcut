import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { projectRoutes } from "../feature/projects/project.routes.js";
import { db } from "../config/db.js";

describe("Project API Endpoints", () => {
  let app: FastifyInstance;

  // ===== Mock IDs =====
  const mockOwnerId = "proj-user-owner-vitest";
  const mockViewerId = "proj-user-viewer-vitest";
  const mockAssetId = "proj-asset-vitest-001";

  // ===== Shared state ข้าม test =====
  let workspaceId: string;
  let projectId: string;

  // ===== Setup: สร้างข้อมูล fixture ใน DB โดยตรง =====
  beforeAll(async () => {
    // 1. สร้าง mock users
    await db.user.upsert({
      where: { id: mockOwnerId },
      update: {},
      create: {
        id: mockOwnerId,
        email: "proj-owner-vitest@example.com",
        name: "Project Owner",
        password_hash: "hashed",
      },
    });

    await db.user.upsert({
      where: { id: mockViewerId },
      update: {},
      create: {
        id: mockViewerId,
        email: "proj-viewer-vitest@example.com",
        name: "Project Viewer",
        password_hash: "hashed",
      },
    });

    // 2. สร้าง workspace
    const workspace = await db.workspace.create({
      data: {
        name: "Vitest Project Workspace",
        slug: `vitest-proj-ws-${Date.now()}`,
        owner_id: mockOwnerId,
      },
    });
    workspaceId = workspace.id;

    // 3. เพิ่ม owner เป็น owner role
    await db.workspaceMember.create({
      data: {
        workspace_id: workspaceId,
        user_id: mockOwnerId,
        role: "owner",
      },
    });

    // 4. เพิ่ม viewer เป็น viewer role
    await db.workspaceMember.create({
      data: {
        workspace_id: workspaceId,
        user_id: mockViewerId,
        role: "viewer",
      },
    });

    // 5. สร้าง mock asset สำหรับใช้ตอน test duplicate (ต้องมีก่อน)
    await db.asset.upsert({
      where: { id: mockAssetId },
      update: {},
      create: {
        id: mockAssetId,
        project_id: undefined as any, // จะ set ทีหลัง
        upload_by: mockOwnerId,
        type: "video",
        original_url: "https://example.com/test.mp4",
        status: "ready",
      },
    }).catch(() => {
      // ถ้าสร้างไม่ได้ (เพราะ FK constraint) ก็ข้ามไป ใช้ test อื่นที่ไม่ต้องการ asset
    });

    // 6. สร้าง Fastify app สำหรับ test
    app = Fastify();

    // Mock auth — อ่าน x-mock-user-id header แทน JWT จริง
    app.decorateRequest("user", null as any);
    app.decorateRequest("jwtVerify", async function () {
      return;
    });
    app.addHook("onRequest", async (request) => {
      const userId =
        (request.headers["x-mock-user-id"] as string) || mockOwnerId;
      request.user = { id: userId, email: "mock@example.com" };
    });

    await app.register(projectRoutes, { prefix: "/projects" });
    await app.ready();
  });

  // ===== Cleanup: ลบข้อมูลทั้งหมดหลัง test =====
  afterAll(async () => {
    if (app) await app.close();

    // ลบตามลำดับ FK dependency
    if (projectId) {
      await db.operationLog.deleteMany({ where: { project_id: projectId } });
      await db.textOverlay.deleteMany({ where: { project_id: projectId } });
      await db.transition.deleteMany({ where: { project_id: projectId } });
    }

    // ลบ projects ที่เป็น copies ด้วย
    const projectsToDelete = await db.project.findMany({
      where: { workspace_id: workspaceId },
    });
    const projectIds = projectsToDelete.map((p) => p.id);

    if (projectIds.length > 0) {
      await db.operationLog.deleteMany({
        where: { project_id: { in: projectIds } },
      });
      await db.textOverlay.deleteMany({
        where: { project_id: { in: projectIds } },
      });
      await db.transition.deleteMany({
        where: { project_id: { in: projectIds } },
      });
      await db.clipEffect.deleteMany({
        where: { clip: { project_id: { in: projectIds } } },
      });
      await db.clip.deleteMany({
        where: { project_id: { in: projectIds } },
      });
      await db.track.deleteMany({
        where: { project_id: { in: projectIds } },
      });
      await db.project.deleteMany({
        where: { id: { in: projectIds } },
      });
    }

    await db.workspaceMember.deleteMany({
      where: { workspace_id: workspaceId },
    });
    await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    await db.user
      .deleteMany({ where: { id: { in: [mockOwnerId, mockViewerId] } } })
      .catch(() => {});
  });

  // ===== Test 1: POST /projects — สร้าง project สำเร็จ =====
  it("should create a new project successfully", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { "x-mock-user-id": mockOwnerId },
      payload: {
        name: "My Vitest Project",
        description: "Test project description",
        workspaceId,
      },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 201) console.log("CREATE ERROR:", body);

    expect(response.statusCode).toBe(201);
    expect(body.project.name).toBe("My Vitest Project");
    expect(body.project.workspace_id).toBe(workspaceId);

    // ตรวจสอบว่า settings default ถูก set ถูกต้อง
    expect(body.project.settings).toMatchObject({
      resolution: "1080p",
      fps: 30,
      duration_ms: 0,
    });

    // เก็บ projectId ไว้ใช้ test ต่อไป
    projectId = body.project.id;
  });

  // ===== Test 2: GET /projects/:id — ดึง full timeline =====
  it("should get project with full timeline", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/projects/${projectId}`,
      headers: { "x-mock-user-id": mockOwnerId },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 200) console.log("GET ERROR:", body);

    expect(response.statusCode).toBe(200);
    expect(body.project.id).toBe(projectId);

    // ตรวจสอบว่า response มี timeline fields ครบ
    expect(body.project).toHaveProperty("tracks");
    expect(body.project).toHaveProperty("transitions");
    expect(body.project).toHaveProperty("text_overlays");
    expect(Array.isArray(body.project.tracks)).toBe(true);
  });

  // ===== Test 3: DELETE /projects/:id — Soft Delete =====
  it("should soft delete a project (set deleted_at)", async () => {
    // สร้าง project ชั่วคราวเพื่อ delete
    const createRes = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { "x-mock-user-id": mockOwnerId },
      payload: { name: "To Be Deleted", workspaceId },
    });
    const { project: tempProject } = JSON.parse(createRes.payload);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/projects/${tempProject.id}`,
      headers: { "x-mock-user-id": mockOwnerId },
    });

    expect(deleteRes.statusCode).toBe(200);

    // ตรวจสอบใน DB ว่า deleted_at ถูก set จริง (ไม่ได้ลบออก)
    const deleted = await db.project.findUnique({
      where: { id: tempProject.id },
    });
    expect(deleted).not.toBeNull();
    expect(deleted!.deleted_at).not.toBeNull();
  });

  // ===== Test 4: POST /projects/:id/duplicate — Copy ครบทุก relation =====
  it("should duplicate a project with correct naming", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/duplicate`,
      headers: { "x-mock-user-id": mockOwnerId },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 201) console.log("DUPLICATE ERROR:", body);

    expect(response.statusCode).toBe(201);

    // ตรวจสอบชื่อขึ้นต้นด้วย "Copy of"
    expect(body.project.name).toMatch(/^Copy of My Vitest Project/);

    // ตรวจสอบว่า project ใหม่อยู่ใน workspace เดิม
    expect(body.project.workspace_id).toBe(workspaceId);

    // ตรวจสอบว่า duplicated project มีอยู่ใน DB จริง
    const duplicated = await db.project.findUnique({
      where: { id: body.project.id },
    });
    expect(duplicated).not.toBeNull();
  });

  // ===== Test 5: Permission — Viewer ไม่สามารถ PATCH ได้ =====
  it("should return 403 when viewer tries to update a project", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}`,
      headers: { "x-mock-user-id": mockViewerId }, // viewer!
      payload: { name: "Hacked Name" },
    });

    const body = JSON.parse(response.payload);

    expect(response.statusCode).toBe(403);
    expect(body.error).toBe("Forbidden");
  });
});
