import type { FastifyRequest, FastifyReply } from "fastify";
import "@fastify/jwt";

// ===== Auth Extractor =====
// Responsibility: สกัด JWT จาก Authorization Header (Bearer), ถอดรหัส, และฝังข้อมูลลงใน request.user
// หากไม่มี Token หรือ Token หมดอายุ จะเตะผู้ใช้ออกทันที (401 Unauthorized) เพื่อป้องกันไม่ให้เข้าถึง Controller
export const authExtractor = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply
      .status(401)
      .send({ error: "Unauthorized or invalid access token" });
  }
};
