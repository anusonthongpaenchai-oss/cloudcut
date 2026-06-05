import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { exportRoutes } from "../feature/exports/export.routes.js";
import { projectRoutes } from "../feature/projects/project.routes.js";
import { db } from "../config/db.js";

// ===== Mock External Services =====
// Mock renderQueue เพื่อไม่ยิง Redis จริง
vi.mock("../lib/queue.js", () => ({
  processingQueue: {
    add: vi.fn().mockResolvedValue({ id: "mock-processing-job-id" }),
  },
  renderQueue: {
    add: vi.fn().mockResolvedValue({ id: "mock-render-job-id" }),
    getJob: vi.fn().mockResolvedValue(null), // ไม่พบ job ใน queue
  },
}));

describe("Export API Endpoints", () => {
  let app: FastifyInstance;

  // ===== Mock IDs =====
  const mockOwnerId = "export-user-owner-vitest";
  const mockEditorId = "export-user-editor-vitest";
  const mockViewerId = "export-user-viewer-vitest";

  // ===== Shared state ข้าม test =====
  let workspaceId: string;
  let projectId: string;
  let exportJobId: string;

  // ===== Setup =====
  beforeAll(async () => {
    // 1. สร้าง mock users
    await db.user.upsert({
      where: { id: mockOwnerId },
      update: {},
      create: {
        id: mockOwnerId,
        email: "export-owner-vitest@example.com",
        name: "Export Owner",
        password_hash: "hashed",
      },
    });

    await db.user.upsert({
      where: { id: mockEditorId },
      update: {},
      create: {
        id: mockEditorId,
        email: "export-editor-vitest@example.com",
        name: "Export Editor",
        password_hash: "hashed",
      },
    });

    await db.user.upsert({
      where: { id: mockViewerId },
      update: {},
      create: {
        id: mockViewerId,
        email: "export-viewer-vitest@example.com",
        name: "Export Viewer",
        password_hash: "hashed",
      },
    });

    // 2. สร้าง workspace
    const workspace = await db.workspace.create({
      data: {
        name: "Vitest Export Workspace",
        slug: `vitest-export-ws-${Date.now()}`,
        owner_id: mockOwnerId,
      },
    });
    workspaceId = workspace.id;

    // 3. เพิ่มสมาชิก
    await db.workspaceMember.createMany({
      data: [
        { workspace_id: workspaceId, user_id: mockOwnerId, role: "owner" },
        { workspace_id: workspaceId, user_id: mockEditorId, role: "editor" },
        { workspace_id: workspaceId, user_id: mockViewerId, role: "viewer" },
      ],
    });

    // 4. สร้าง project
    const project = await db.project.create({
      data: {
        name: "Export Test Project",
        workspace_id: workspaceId,
        created_by: mockOwnerId,
        settings: { resolution: "1080p", fps: 30, duration_ms: 60000 },
      },
    });
    projectId = project.id;

    // 5. สร้าง Fastify app สำหรับ test
    app = Fastify();

    // Mock auth
    app.decorateRequest("user", null as any);
    app.decorateRequest("jwtVerify", async function () {
      return;
    });
    app.addHook("onRequest", async (request) => {
      const userId =
        (request.headers["x-mock-user-id"] as string) || mockOwnerId;
      request.user = { id: userId, email: "mock@example.com" };
    });

    // Register routes — export routes ที่ root + project routes สำหรับ /projects/:id/exports
    await app.register(exportRoutes);
    await app.register(projectRoutes, { prefix: "/projects" });
    await app.ready();
  });

  // ===== Cleanup =====
  afterAll(async () => {
    if (app) await app.close();

    await db.processingJob.deleteMany({
      where: { export_job: { project_id: projectId } },
    }).catch(() => {});
    await db.exportJob.deleteMany({ where: { project_id: projectId } }).catch(() => {});
    await db.project.delete({ where: { id: projectId } }).catch(() => {});
    await db.workspaceMember.deleteMany({ where: { workspace_id: workspaceId } }).catch(() => {});
    await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    await db.user
      .deleteMany({
        where: { id: { in: [mockOwnerId, mockEditorId, mockViewerId] } },
      })
      .catch(() => {});
  });

  // ===== Test 1: POST /projects/:id/exports — สร้าง job + handles idempotency =====
  it("should create an export job successfully", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/exports`,
      headers: { "x-mock-user-id": mockOwnerId },
      payload: {
        format: "mp4",
        resolution: "p1080",
        quality: "high",
      },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 201) console.log("CREATE EXPORT ERROR:", body);

    expect(response.statusCode).toBe(201);
    expect(body.job.project_id).toBe(projectId);
    expect(body.job.format).toBe("mp4");
    expect(body.job.resolution).toBe("p1080");
    expect(body.job.quality).toBe("high");
    expect(body.job.status).toBe("queued");
    expect(body.job.idempotency_key).toMatch(/^export_/);
    expect(body.idempotent).toBe(false);

    // เก็บ exportJobId ไว้ใช้ test ต่อไป
    exportJobId = body.job.id;

    // ตรวจสอบว่า ProcessingJob ถูกสร้างใน DB ด้วย
    const processingJob = await db.processingJob.findFirst({
      where: { export_job_id: exportJobId },
    });
    expect(processingJob).not.toBeNull();
    expect(processingJob!.kind).toBe("render_export");
    expect(processingJob!.status).toBe("queued");
  });

  it("should handle idempotency — return existing job when key is duplicate", async () => {
    // เรียก POST ซ้ำภายใน 1 นาทีเดียวกัน (idempotency_key จะเหมือนกัน)
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/exports`,
      headers: { "x-mock-user-id": mockOwnerId },
      payload: {
        format: "mp4",
        resolution: "p1080",
        quality: "high",
      },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 200) console.log("IDEMPOTENT ERROR:", body);

    // ต้องได้ 200 (ไม่ใช่ 201) และ idempotent: true
    expect(response.statusCode).toBe(200);
    expect(body.idempotent).toBe(true);
    // ต้องเป็น job เดิม (id เดิม)
    expect(body.job.id).toBe(exportJobId);
  });

  // ===== Test 2: GET /exports/:id — returns progress =====
  it("should return export job progress", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/exports/${exportJobId}`,
      headers: { "x-mock-user-id": mockOwnerId },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 200) console.log("GET EXPORT ERROR:", body);

    expect(response.statusCode).toBe(200);
    expect(body.job.id).toBe(exportJobId);
    expect(body.job.status).toBe("queued");
    expect(body.job.progress_percent).toBe(0);
    // output_url ยังเป็น null เพราะยังไม่ได้ render
    expect(body.job.output_url).toBeNull();
  });

  // ===== Test 3: DELETE /exports/:id — cancel successfully =====
  it("should cancel an export job successfully", async () => {
    // สร้าง job ใหม่เพื่อ cancel (ไม่อยากยุ่งกับ job ที่ test 2 ใช้)
    // ต้องสร้าง export job โดยตรงใน DB เพราะ idempotency_key ยังซ้ำอยู่
    const jobToCancel = await db.exportJob.create({
      data: {
        project_id: projectId,
        request_by: mockEditorId,
        format: "webm",
        resolution: "p720",
        quality: "draft",
        status: "queued",
        idempotency_key: `export_${projectId}_${mockEditorId}_cancel_test`,
      },
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/exports/${jobToCancel.id}`,
      headers: { "x-mock-user-id": mockEditorId }, // requester cancel ตัวเอง
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 200) console.log("CANCEL ERROR:", body);

    expect(response.statusCode).toBe(200);
    expect(body.job.id).toBe(jobToCancel.id);
    expect(body.job.status).toBe("canceled");

    // ตรวจสอบใน DB ด้วยว่า status เปลี่ยนจริง
    const updated = await db.exportJob.findUnique({
      where: { id: jobToCancel.id },
    });
    expect(updated!.status).toBe("canceled");
  });

  it("should allow owner to cancel another user's export", async () => {
    // สร้าง job ของ editor
    const editorJob = await db.exportJob.create({
      data: {
        project_id: projectId,
        request_by: mockEditorId,
        format: "mp4",
        resolution: "p1080",
        quality: "standard",
        status: "queued",
        idempotency_key: `export_${projectId}_${mockEditorId}_owner_cancel_test`,
      },
    });

    // owner cancel job ของ editor
    const response = await app.inject({
      method: "DELETE",
      url: `/exports/${editorJob.id}`,
      headers: { "x-mock-user-id": mockOwnerId }, // owner cancel ของคนอื่น
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.job.status).toBe("canceled");
  });

  it("should return 403 when viewer tries to create an export", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/exports`,
      headers: { "x-mock-user-id": mockViewerId }, // viewer!
      payload: {
        format: "mp4",
        resolution: "p720",
        quality: "draft",
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe("Forbidden");
  });

  it("should return 403 when editor tries to cancel another user's export", async () => {
    // สร้าง job ของ owner
    const ownerJob = await db.exportJob.create({
      data: {
        project_id: projectId,
        request_by: mockOwnerId,
        format: "mp4",
        resolution: "p4k",
        quality: "high",
        status: "queued",
        idempotency_key: `export_${projectId}_${mockOwnerId}_editor_try_cancel`,
      },
    });

    // editor พยายาม cancel job ของ owner (ไม่ได้!)
    const response = await app.inject({
      method: "DELETE",
      url: `/exports/${ownerJob.id}`,
      headers: { "x-mock-user-id": mockEditorId }, // editor ไม่ใช่ requester, ไม่ใช่ owner
    });

    expect(response.statusCode).toBe(403);
  });
});
