import type { FastifyInstance } from "fastify";
import { authExtractor } from "../../middlewares/auth.middleware.js";
import { AssetController } from "./asset.controller.js";

export const assetRoutes = async (fastify: FastifyInstance) => {
  // ทุก route ต้องผ่าน JWT verification ก่อน
  fastify.addHook("preHandler", authExtractor);

  // POST /assets/presigned-url — ขอ URL สำหรับอัปโหลดไฟล์ไปที่ S3
  fastify.post("/presigned-url", AssetController.getPresignedUrl);

  // POST /assets/confirm-upload — ยืนยันว่าอัปโหลดเสร็จแล้ว
  fastify.post("/confirm-upload", AssetController.confirmUpload);

  // GET /assets?projectId=X — ดูรายการ Asset ใน Project
  fastify.get("/", AssetController.listAssets);

  // GET /assets/:id — ดู Asset พร้อม variants
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    AssetController.getAssetById
  );

  // DELETE /assets/:id — ลบ Asset (Soft Delete)
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    AssetController.deleteAsset
  );
};
