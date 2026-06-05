import type { FastifyReply, FastifyRequest } from "fastify";
import { AssetService } from "./asset.service.js";
import {
  presignedUrlSchema,
  confirmUploadSchema,
  listAssetsSchema,
} from "./asset.schema.js";

export class AssetController {
  // ===== 1. ขอ Presigned URL =====
  static async getPresignedUrl(request: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = presignedUrlSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message });
      }

      const userId = request.user.id;
      const result = await AssetService.getPresignedUrl({
        projectId: parsed.data.projectId,
        userId,
        filename: parsed.data.filename,
        contentType: parsed.data.contentType,
      });

      return reply.status(200).send(result);
    } catch (error: any) {
      if (error.message?.startsWith("Forbidden")) {
        return reply
          .status(403)
          .send({ error: "Forbidden", message: error.message });
      }
      if (error.message?.startsWith("Not Found")) {
        return reply
          .status(404)
          .send({ error: "Not Found", message: "Project not found" });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 2. ยืนยันการอัปโหลด =====
  static async confirmUpload(request: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = confirmUploadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message });
      }

      const userId = request.user.id;
      const asset = await AssetService.confirmUpload({
        projectId: parsed.data.projectId,
        userId,
        assetKey: parsed.data.assetKey,
        type: parsed.data.type,
      });

      return reply
        .status(201)
        .send({ message: "Asset uploaded and processing started", asset });
    } catch (error: any) {
      if (error.message?.startsWith("Forbidden")) {
        return reply
          .status(403)
          .send({ error: "Forbidden", message: error.message });
      }
      if (error.message?.startsWith("Not Found")) {
        return reply
          .status(404)
          .send({ error: "Not Found", message: "Project not found" });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 3. ดึงรายการ Asset =====
  static async listAssets(request: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = listAssetsSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message });
      }

      const userId = request.user.id;
      const result = await AssetService.listAssets({
        projectId: parsed.data.projectId,
        userId,
        cursor: parsed.data.cursor,
        limit: parsed.data.limit,
      });

      return reply.status(200).send(result);
    } catch (error: any) {
      if (error.message?.startsWith("Forbidden")) {
        return reply
          .status(403)
          .send({ error: "Forbidden", message: error.message });
      }
      if (error.message === "Invalid cursor format") {
        return reply.status(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 4. ดึง Asset พร้อม Variants =====
  static async getAssetById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user.id;

      const asset = await AssetService.getAssetById({ assetId: id, userId });

      return reply.status(200).send({ asset });
    } catch (error: any) {
      if (error.message?.startsWith("Forbidden")) {
        return reply
          .status(403)
          .send({ error: "Forbidden", message: error.message });
      }
      if (error.message?.startsWith("Not Found")) {
        return reply
          .status(404)
          .send({ error: "Not Found", message: "Asset not found" });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 5. Soft Delete Asset =====
  static async deleteAsset(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user.id;

      await AssetService.softDeleteAsset({ assetId: id, userId });

      return reply
        .status(200)
        .send({ message: "Asset deleted successfully" });
    } catch (error: any) {
      if (error.message?.startsWith("Forbidden")) {
        return reply
          .status(403)
          .send({ error: "Forbidden", message: error.message });
      }
      if (error.message?.startsWith("Not Found")) {
        return reply
          .status(404)
          .send({ error: "Not Found", message: "Asset not found" });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }
}
