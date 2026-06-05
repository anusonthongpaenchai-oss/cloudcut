import { db } from "../../config/db.js";
import { s3Client } from "../../lib/s3.js";
import { processingQueue } from "../../lib/queue.js";
import { pusher } from "../../lib/pusher.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { Prisma, AssetType } from "@prisma/client";

// ===== Type Definitions =====
type Role = "owner" | "admin" | "editor" | "viewer";

export class AssetService {
  // Helper สำหรับเช็กสิทธิ์ Workspace จาก Project ID
  private static async checkProjectPermission(
    projectId: string,
    userId: string,
    requiredRoles: Role[]
  ) {
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.deleted_at) {
      throw new Error("Not Found: Project not found");
    }

    const member = await db.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: project.workspace_id,
          user_id: userId,
        },
      },
    });

    if (!member) {
      throw new Error("Forbidden: You are not a member of this workspace");
    }

    if (!requiredRoles.includes(member.role as Role)) {
      throw new Error(`Forbidden: Insufficient permissions, requires one of: ${requiredRoles.join(", ")}`);
    }

    return project;
  }

  // ===== 1. ขอ Presigned URL =====
  static async getPresignedUrl(input: {
    projectId: string;
    userId: string;
    filename: string;
    contentType: string;
  }) {
    const { projectId, userId, filename, contentType } = input;

    // เช็กสิทธิ์ (editor ขึ้นไปถึงจะอัปโหลดได้)
    await this.checkProjectPermission(projectId, userId, ["owner", "admin", "editor"]);

    const uuid = randomUUID();
    // สร้าง Object Key ตาม format projects/{projectId}/{uuid}-{filename}
    const assetKey = `projects/${projectId}/${uuid}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const bucket = process.env.S3_BUCKET || "cloudcut-assets";

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: assetKey,
      ContentType: contentType,
    });

    // สร้าง URL ให้ client ใช้ upload ทันที
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return { presignedUrl, assetKey };
  }

  // ===== 2. ยืนยันการอัปโหลด =====
  static async confirmUpload(input: {
    projectId: string;
    userId: string;
    assetKey: string;
    type: AssetType;
  }) {
    const { projectId, userId, assetKey, type } = input;

    // เช็กสิทธิ์
    await this.checkProjectPermission(projectId, userId, ["owner", "admin", "editor"]);

    const bucket = process.env.S3_BUCKET || "cloudcut-assets";
    // Construct original URL from bucket and key
    // สมมติว่า bucket public หรือใช้ CDN ต่อ แต่เราบันทึก path ไว้
    const originalUrl = `${bucket}/${assetKey}`;

    // 1. สร้าง Asset row ลง Database ในสถานะ processing (เพราะต้องส่งคิวไปดึง metadata)
    const asset = await db.asset.create({
      data: {
        project_id: projectId,
        upload_by: userId,
        type,
        original_url: originalUrl,
        status: "processing", // ตาม requirement: upload แล้วคิว job เลย
      },
    });

    // 2. Enqueue Job ไปที่ BullMQ
    await processingQueue.add(
      "extract_metadata",
      {
        assetId: asset.id,
        projectId,
        assetKey,
      },
      {
        jobId: `extract-metadata-${asset.id}`, // ป้องกันคิวซ้ำ
      }
    );
    
    // สร้าง ProcessingJob ใน DB ด้วย เพื่อให้ Query หา Job ได้
    await db.processingJob.create({
      data: {
        kind: "extract_metadata",
        status: "queued",
        asset_id: asset.id,
      }
    });

    // 3. แจ้งเตือน Client ผ่าน Pusher 
    // Channel: private-user-{userId}
    // Event: asset-upload-confirmed
    await pusher.trigger(`private-user-${userId}`, "asset-upload-confirmed", {
      assetId: asset.id,
      projectId: asset.project_id,
      status: "processing",
    });

    return asset;
  }

  // ===== 3. ดึงรายการ Asset ใน Project =====
  static async listAssets(input: {
    projectId: string;
    userId: string;
    cursor?: string | undefined;
    limit: number;
  }) {
    const { projectId, userId, cursor, limit } = input;

    // เช็กสิทธิ์ (viewer ขึ้นไปดูได้)
    await this.checkProjectPermission(projectId, userId, ["owner", "admin", "editor", "viewer"]);

    let cursorDate: Date | null = null;
    let cursorId: string | null = null;

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
        cursorDate = new Date(decoded.updated_at);
        cursorId = decoded.id;
      } catch {
        throw new Error("Invalid cursor format");
      }
    }

    const whereCondition: Prisma.AssetWhereInput = {
      project_id: projectId,
      deleted_at: null,
      ...(cursorDate !== null && cursorId !== null
        ? {
            OR: [
              { updated_at: { lt: cursorDate } },
              { updated_at: { equals: cursorDate }, id: { lt: cursorId } },
            ],
          }
        : {}),
    };

    const assets = await db.asset.findMany({
      where: whereCondition,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = assets.length > limit;
    const result = hasMore ? assets.slice(0, limit) : assets;

    let nextCursor: string | null = null;
    const lastItem = result.at(-1);
    if (hasMore && lastItem) {
      nextCursor = Buffer.from(
        JSON.stringify({
          updated_at: lastItem.updated_at.toISOString(),
          id: lastItem.id,
        })
      ).toString("base64");
    }

    return { assets: result, nextCursor, hasMore };
  }

  // ===== 4. ดึง Asset พร้อม Variants =====
  static async getAssetById(input: { assetId: string; userId: string }) {
    const { assetId, userId } = input;

    const asset = await db.asset.findUnique({
      where: { id: assetId },
      include: { variants: true },
    });

    if (!asset || asset.deleted_at) {
      throw new Error("Not Found: Asset not found");
    }

    // เช็กสิทธิ์ (viewer ขึ้นไปดูได้)
    await this.checkProjectPermission(asset.project_id, userId, ["owner", "admin", "editor", "viewer"]);

    return asset;
  }

  // ===== 5. ลบ Asset (Soft Delete) =====
  static async softDeleteAsset(input: { assetId: string; userId: string }) {
    const { assetId, userId } = input;

    const asset = await db.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset || asset.deleted_at) {
      throw new Error("Not Found: Asset not found");
    }

    // เช็กสิทธิ์ (editor ขึ้นไปถึงจะลบได้)
    await this.checkProjectPermission(asset.project_id, userId, ["owner", "admin", "editor"]);

    await db.asset.update({
      where: { id: assetId },
      data: { deleted_at: new Date() },
    });

    // Option: แจ้งเตือนผ่าน Pusher หรือ Enqueue cleanup job เพื่อลบไฟล์จริงออกจาก S3 ในภายหลัง
  }
}
