import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { projectRoutes } from "../feature/projects/project.routes.js";
import { db } from "../config/db.js";

// ===== Mock External Services =====
// Mock Pusher เพื่อไม่ให้ยิง network request จริง
vi.mock("../lib/pusher.js", () => ({
  pusher: {
    trigger: vi.fn().mockResolvedValue({}),
  },
}));

describe("Timeline API Endpoints", () => {
  let app: FastifyInstance;

  // ===== Mock IDs =====
  const mockOwnerId = "timeline-user-owner-vitest";
  const mockViewerId = "timeline-user-viewer-vitest";

  // ===== Shared state ข้าม test =====
  let workspaceId: string;
  let projectId: string;
  let assetId: string;
  let trackId: string;
  let clipId: string;

  // ===== Setup: สร้างข้อมูล fixture ใน DB โดยตรง =====
  beforeAll(async () => {
    // 1. สร้าง mock users
    await db.user.upsert({
      where: { id: mockOwnerId },
      update: {},
      create: {
        id: mockOwnerId,
        email: "timeline-owner-vitest@example.com",
        name: "Timeline Owner",
        password_hash: "hashed",
      },
    });

    await db.user.upsert({
      where: { id: mockViewerId },
      update: {},
      create: {
        id: mockViewerId,
        email: "timeline-viewer-vitest@example.com",
        name: "Timeline Viewer",
        password_hash: "hashed",
      },
    });

    // 2. สร้าง workspace
    const workspace = await db.workspace.create({
      data: {
        name: "Vitest Timeline Workspace",
        slug: `vitest-timeline-ws-${Date.now()}`,
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

    // 5. สร้าง project
    const project = await db.project.create({
      data: {
        name: "Timeline Test Project",
        workspace_id: workspaceId,
        created_by: mockOwnerId,
        settings: { resolution: "1080p", fps: 30, duration_ms: 0 },
      },
    });
    projectId = project.id;

    // 6. สร้าง asset สำหรับใช้ใน clip
    const asset = await db.asset.create({
      data: {
        project_id: projectId,
        upload_by: mockOwnerId,
        type: "video",
        original_url: "https://example.com/test.mp4",
        status: "ready",
      },
    });
    assetId = asset.id;

    // 7. สร้าง track สำหรับใช้ใน clip test
    const track = await db.track.create({
      data: {
        project_id: projectId,
        type: "video",
        label: "Video Track 1",
        order_index: 0,
        color: "#3B82F6",
      },
    });
    trackId = track.id;

    // 8. สร้าง Fastify app สำหรับ test
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
    await db.operationLog.deleteMany({ where: { project_id: projectId } }).catch(() => {});
    await db.textOverlay.deleteMany({ where: { project_id: projectId } }).catch(() => {});
    await db.transition.deleteMany({ where: { project_id: projectId } }).catch(() => {});
    await db.clipEffect.deleteMany({
      where: { clip: { project_id: projectId } },
    }).catch(() => {});
    await db.clip.deleteMany({ where: { project_id: projectId } }).catch(() => {});
    await db.track.deleteMany({ where: { project_id: projectId } }).catch(() => {});
    await db.asset.deleteMany({ where: { project_id: projectId } }).catch(() => {});
    await db.project.delete({ where: { id: projectId } }).catch(() => {});
    await db.workspaceMember.deleteMany({ where: { workspace_id: workspaceId } }).catch(() => {});
    await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    await db.user
      .deleteMany({ where: { id: { in: [mockOwnerId, mockViewerId] } } })
      .catch(() => {});
  });

  // ===== Test 1: POST /projects/:id/clips — สร้าง clip สำเร็จ + ตรวจ OperationLog =====
  it("should create a clip successfully and write OperationLog", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/clips`,
      headers: { "x-mock-user-id": mockOwnerId },
      payload: {
        trackId,
        assetId,
        name: "Test Clip 1",
        track_position_ms: 0,
        in_point_ms: 0,
        out_point_ms: 5000,
        duration_ms: 5000,
      },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 201) console.log("CREATE CLIP ERROR:", body);

    expect(response.statusCode).toBe(201);
    expect(body.clip.name).toBe("Test Clip 1");
    expect(body.clip.project_id).toBe(projectId);
    expect(body.clip.track_id).toBe(trackId);
    expect(body.clip.duration_ms).toBe(5000);

    // เก็บ clipId ไว้ใช้ test ต่อไป
    clipId = body.clip.id;

    // ตรวจสอบว่า OperationLog ถูกเขียนลง DB จริง
    const log = await db.operationLog.findFirst({
      where: {
        project_id: projectId,
        operation_type: "clip.create",
      },
      orderBy: { server_seq: "desc" },
    });

    expect(log).not.toBeNull();
    expect(log!.user_id).toBe(mockOwnerId);
    expect(log!.operation_type).toBe("clip.create");

    const payload = log!.payload as { clipId: string; trackId: string };
    expect(payload.clipId).toBe(clipId);
    expect(payload.trackId).toBe(trackId);
  });

  // ===== Test 2: POST /projects/:id/clips/:clipId/split — split clip ถูกต้อง =====
  it("should split a clip correctly into two clips", async () => {
    // สร้าง clip ที่จะ split (duration = 10000ms)
    const createRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/clips`,
      headers: { "x-mock-user-id": mockOwnerId },
      payload: {
        trackId,
        assetId,
        name: "Clip To Split",
        track_position_ms: 10000,
        in_point_ms: 0,
        out_point_ms: 10000,
        duration_ms: 10000,
      },
    });
    const { clip: clipToSplit } = JSON.parse(createRes.payload);

    // Split ที่ 4000ms
    const splitRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/clips/${clipToSplit.id}/split`,
      headers: { "x-mock-user-id": mockOwnerId },
      payload: { splitPointMs: 4000 },
    });

    const body = JSON.parse(splitRes.payload);
    if (splitRes.statusCode !== 201) console.log("SPLIT ERROR:", body);

    expect(splitRes.statusCode).toBe(201);

    // ตรวจสอบ original clip (ส่วนแรก)
    const originalClip = body.originalClip;
    expect(originalClip.id).toBe(clipToSplit.id);
    expect(originalClip.duration_ms).toBe(4000);        // ตัดให้เหลือ 4000ms
    expect(originalClip.out_point_ms).toBe(4000);       // in_point(0) + splitPoint(4000)

    // ตรวจสอบ new clip (ส่วนหลัง)
    const newClip = body.newClip;
    expect(newClip.duration_ms).toBe(6000);             // 10000 - 4000
    expect(newClip.in_point_ms).toBe(4000);             // original.in_point(0) + splitPoint(4000)
    expect(newClip.out_point_ms).toBe(10000);           // original.out_point ของเดิม
    expect(newClip.track_position_ms).toBe(14000);      // 10000 + 4000
    expect(newClip.track_id).toBe(trackId);             // อยู่ใน track เดิม

    // ตรวจสอบ OperationLog
    const log = await db.operationLog.findFirst({
      where: {
        project_id: projectId,
        operation_type: "clip.split",
      },
      orderBy: { server_seq: "desc" },
    });

    expect(log).not.toBeNull();
    const payload = log!.payload as { originalClipId: string; newClipId: string; splitPointMs: number };
    expect(payload.originalClipId).toBe(clipToSplit.id);
    expect(payload.newClipId).toBe(newClip.id);
    expect(payload.splitPointMs).toBe(4000);
  });

  // ===== Test 3: Viewer ไม่สามารถ mutate ได้ =====
  it("should return 403 when viewer tries to create a clip", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/clips`,
      headers: { "x-mock-user-id": mockViewerId }, // viewer!
      payload: {
        trackId,
        assetId,
        name: "Unauthorized Clip",
        track_position_ms: 0,
        in_point_ms: 0,
        out_point_ms: 1000,
        duration_ms: 1000,
      },
    });

    const body = JSON.parse(response.payload);

    expect(response.statusCode).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  // ===== Bonus Test: PATCH /projects/:id/clips/:clipId — update clip =====
  it("should update a clip successfully", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}/clips/${clipId}`,
      headers: { "x-mock-user-id": mockOwnerId },
      payload: {
        name: "Updated Clip Name",
        track_position_ms: 1000,
      },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 200) console.log("UPDATE ERROR:", body);

    expect(response.statusCode).toBe(200);
    expect(body.clip.name).toBe("Updated Clip Name");
    expect(body.clip.track_position_ms).toBe(1000);
    expect(body.clip.version).toBe(2); // version increment
  });

  // ===== Bonus Test: POST /projects/:id/tracks — สร้าง track สำเร็จ =====
  it("should create a track successfully", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/tracks`,
      headers: { "x-mock-user-id": mockOwnerId },
      payload: {
        type: "audio",
        label: "Audio Track 1",
        order_index: 1,
        color: "#10B981",
      },
    });

    const body = JSON.parse(response.payload);
    if (response.statusCode !== 201) console.log("CREATE TRACK ERROR:", body);

    expect(response.statusCode).toBe(201);
    expect(body.track.type).toBe("audio");
    expect(body.track.label).toBe("Audio Track 1");
    expect(body.track.project_id).toBe(projectId);

    // ตรวจสอบ OperationLog
    const log = await db.operationLog.findFirst({
      where: {
        project_id: projectId,
        operation_type: "track.create",
      },
      orderBy: { server_seq: "desc" },
    });
    expect(log).not.toBeNull();
  });
});
