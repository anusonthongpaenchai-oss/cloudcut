import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetController } from "../feature/assets/asset.controller.js";
import { AssetService } from "../feature/assets/asset.service.js";

// Mock Dependencies
vi.mock("../config/db.js", () => ({
  db: {
    project: {
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
    },
    asset: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    processingJob: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../lib/s3.js", () => ({
  s3Client: {},
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://mock-presigned-url.com"),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: vi.fn(),
}));

vi.mock("../lib/queue.js", () => ({
  processingQueue: {
    add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
  },
}));

vi.mock("../lib/pusher.js", () => ({
  pusher: {
    trigger: vi.fn().mockResolvedValue(true),
  },
}));

import { db } from "../config/db.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { processingQueue } from "../lib/queue.js";
import { pusher } from "../lib/pusher.js";

describe("Asset API", () => {
  const mockUserId = "user-123";
  const mockProjectId = "00000000-0000-0000-0000-000000000000";

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock default successful project & member (editor)
    vi.mocked(db.project.findUnique).mockResolvedValue({
      id: mockProjectId,
      workspace_id: "workspace-123",
      deleted_at: null,
    } as any);

    vi.mocked(db.workspaceMember.findUnique).mockResolvedValue({
      role: "editor",
    } as any);
  });

  it("POST /assets/presigned-url returns a valid URL", async () => {
    const input = {
      projectId: mockProjectId,
      userId: mockUserId,
      filename: "test.mp4",
      contentType: "video/mp4",
    };

    const result = await AssetService.getPresignedUrl(input);

    expect(getSignedUrl).toHaveBeenCalled();
    expect(result.presignedUrl).toBe("https://mock-presigned-url.com");
    expect(result.assetKey).toContain("test.mp4");
  });

  it("POST /assets/confirm-upload creates Asset row and enqueues job", async () => {
    const assetId = "mock-asset-id";
    vi.mocked(db.asset.create).mockResolvedValue({
      id: assetId,
      project_id: mockProjectId,
      status: "processing",
    } as any);

    const input = {
      projectId: mockProjectId,
      userId: mockUserId,
      assetKey: `projects/${mockProjectId}/uuid-test.mp4`,
      type: "video" as const,
    };

    const result = await AssetService.confirmUpload(input);

    expect(db.asset.create).toHaveBeenCalled();
    expect(processingQueue.add).toHaveBeenCalledWith(
      "extract_metadata",
      expect.objectContaining({ assetId }),
      expect.any(Object)
    );
    expect(pusher.trigger).toHaveBeenCalledWith(
      `private-user-${mockUserId}`,
      "asset-upload-confirmed",
      expect.objectContaining({ assetId })
    );
    expect(result.id).toBe(assetId);
  });

  it("GET /assets/:id returns asset with variants", async () => {
    const assetId = "mock-asset-id";
    vi.mocked(db.asset.findUnique).mockResolvedValue({
      id: assetId,
      project_id: mockProjectId,
      variants: [{ id: "variant-1" }],
      deleted_at: null,
    } as any);

    const result = await AssetService.getAssetById({ assetId, userId: mockUserId });

    expect(db.asset.findUnique).toHaveBeenCalledWith({
      where: { id: assetId },
      include: { variants: true },
    });
    expect(result.variants).toHaveLength(1);
  });

  it("DELETE /assets/:id performs soft delete", async () => {
    const assetId = "mock-asset-id";
    vi.mocked(db.asset.findUnique).mockResolvedValue({
      id: assetId,
      project_id: mockProjectId,
      deleted_at: null,
    } as any);

    await AssetService.softDeleteAsset({ assetId, userId: mockUserId });

    expect(db.asset.update).toHaveBeenCalledWith({
      where: { id: assetId },
      data: { deleted_at: expect.any(Date) },
    });
  });

  it("viewer cannot upload", async () => {
    // Override role to viewer
    vi.mocked(db.workspaceMember.findUnique).mockResolvedValue({
      role: "viewer",
    } as any);

    const input = {
      projectId: mockProjectId,
      userId: mockUserId,
      filename: "test.mp4",
      contentType: "video/mp4",
    };

    await expect(AssetService.getPresignedUrl(input)).rejects.toThrow(/Forbidden/);
  });
});
