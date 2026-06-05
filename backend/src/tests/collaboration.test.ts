import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { collaborationRoutes } from "../feature/collaboration/collaboration.routes.js";
import { db } from "../config/db.js";

// ===== Mock External Services =====
vi.mock("../lib/pusher.js", () => ({
  pusher: {
    authorizeChannel: vi.fn().mockImplementation((socketId, channel, data) => {
      return {
        auth: "mock_signature",
        channel_data: data ? JSON.stringify(data) : undefined,
      };
    }),
  },
}));

describe("Collaboration API Endpoints", () => {
  let app: FastifyInstance;

  // ===== Mock IDs =====
  const mockOwnerId = "collab-user-owner-vitest";
  const mockNonMemberId = "collab-user-nonmember-vitest";

  // ===== Shared state =====
  let workspaceId: string;
  let projectId: string;

  // ===== Setup =====
  beforeAll(async () => {
    // 1. Create mock users
    await db.user.upsert({
      where: { id: mockOwnerId },
      update: {},
      create: {
        id: mockOwnerId,
        email: "collab-owner-vitest@example.com",
        name: "Collab Owner",
        password_hash: "hashed",
        avatar_url: "https://example.com/avatar.jpg",
      },
    });

    await db.user.upsert({
      where: { id: mockNonMemberId },
      update: {},
      create: {
        id: mockNonMemberId,
        email: "collab-nonmember-vitest@example.com",
        name: "Collab NonMember",
        password_hash: "hashed",
      },
    });

    // 2. Create workspace
    const workspace = await db.workspace.create({
      data: {
        name: "Vitest Collab Workspace",
        slug: `vitest-collab-ws-${Date.now()}`,
        owner_id: mockOwnerId,
      },
    });
    workspaceId = workspace.id;

    // 3. Add owner as member (NonMember is NOT added)
    await db.workspaceMember.create({
      data: {
        workspace_id: workspaceId,
        user_id: mockOwnerId,
        role: "owner",
      },
    });

    // 4. Create project
    const project = await db.project.create({
      data: {
        name: "Collab Test Project",
        workspace_id: workspaceId,
        created_by: mockOwnerId,
        settings: {},
      },
    });
    projectId = project.id;

    // 5. Create some operation logs (105 logs to test tooLarge logic)
    const logs = Array.from({ length: 105 }).map((_, i) => ({
      project_id: projectId,
      user_id: mockOwnerId,
      operation_type: "test.operation",
      payload: { index: i },
      client_seq: i,
    }));
    await db.operationLog.createMany({ data: logs });

    // 6. Setup Fastify app
    app = Fastify();

    // Mock auth middleware - we'll bypass real JWT
    app.decorateRequest("user", null as any);
    app.decorateRequest("jwtVerify", async function () {
      return;
    });
    app.addHook("onRequest", async (request) => {
      const userId =
        (request.headers["x-mock-user-id"] as string) || mockOwnerId;
      request.user = { id: userId, email: "mock@example.com" };
    });

    await app.register(collaborationRoutes);
    await app.ready();
  });

  // ===== Cleanup =====
  afterAll(async () => {
    if (app) await app.close();

    await db.operationLog
      .deleteMany({ where: { project_id: projectId } })
      .catch(() => {});
    await db.project.delete({ where: { id: projectId } }).catch(() => {});
    await db.workspaceMember
      .deleteMany({ where: { workspace_id: workspaceId } })
      .catch(() => {});
    await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    await db.user
      .deleteMany({ where: { id: { in: [mockOwnerId, mockNonMemberId] } } })
      .catch(() => {});
  });

  // ===== Test 1: POST /pusher/auth - Success for member =====
  it("should authenticate pusher channel for workspace member", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/pusher/auth`,
      headers: { "x-mock-user-id": mockOwnerId },
      payload: {
        socket_id: "1234.5678",
        channel_name: `presence-project-${projectId}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.auth).toBe("mock_signature");
    expect(body.channel_data).toContain("Collab Owner");
    expect(body.channel_data).toContain(mockOwnerId);
  });

  // ===== Test 2: POST /pusher/auth - Deny non-member =====
  it("should deny pusher auth for non-member", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/pusher/auth`,
      headers: { "x-mock-user-id": mockNonMemberId },
      payload: {
        socket_id: "1234.5678",
        channel_name: `private-project-${projectId}`,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.payload);
    expect(body.error).toContain("Forbidden");
  });

  // ===== Test 3: GET /projects/:id/operations?afterSeq=100 - Normal sync =====
  it("should return operations if gap is small", async () => {
    // We created 105 logs. If we ask afterSeq=100, we should get the last 5
    // Need to find actual server_seq values since they are auto-incremented globally
    const latestLogs = await db.operationLog.findMany({
      where: { project_id: projectId },
      orderBy: { server_seq: "asc" },
    });

    // Pick a sequence number 5 items before the end
    const targetLog = latestLogs[latestLogs.length - 6];
    expect(targetLog).toBeDefined();
    const afterSeqTarget = targetLog!.server_seq;

    const response = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/operations?afterSeq=${afterSeqTarget}`,
      headers: { "x-mock-user-id": mockOwnerId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.operations).toBeDefined();
    expect(body.operations.length).toBe(5);
  });

  // ===== Test 4: GET /projects/:id/operations?afterSeq=0 - tooLarge logic =====
  it("should return tooLarge: true when gap is > 100", async () => {
    // There are 105 logs, so asking for everything after 0 will return > 100
    const response = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/operations?afterSeq=0`,
      headers: { "x-mock-user-id": mockOwnerId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.tooLarge).toBe(true);
    expect(body.operations).toBeUndefined();
  });
});
