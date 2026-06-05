import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service.js";
import { registerSchema, loginSchema } from "./auth.schema.js";

export class AuthController {
  // ===== Register Handler =====
  // Responsibility: รับ Payload จากผู้ใช้, ตรวจสอบความถูกต้อง, บันทึกลงฐานข้อมูล, และสร้าง Tokens
  static async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validateRequest = registerSchema.safeParse(request.body);
      if (!validateRequest.success) {
        return reply.status(400).send({
          error: validateRequest.error?.issues[0]?.message,
        });
      }

      const { email, password, name } = validateRequest.data;
      const user = await AuthService.registerUser(email, password, name);

      const payload = {
        id: user.id,
        email: user.email,
      };

      const accessToken = request.server.jwt.sign(payload, { expiresIn: "2h" });
      const refreshToken = request.server.jwt.sign(payload, {
        expiresIn: "15d",
      });

      return reply.status(201).send({
        message: "User registered successfully",
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error: any) {
      if (error.message === "Email already exists") {
        return reply.status(400).send({ error: error.message });
      }

      request.server.log.error(error);
      return reply.status(500).send({ error: "Connect server fail" });
    }
  }

  // ===== Login Handler =====
  // Responsibility: ยืนยันตัวตนผู้ใช้และสร้าง Tokens
  static async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validateRequest = loginSchema.safeParse(request.body);
      if (!validateRequest.success) {
        return reply.status(400).send({
          error: validateRequest.error?.issues[0]?.message,
        });
      }

      const { email, password } = validateRequest.data;
      const user = await AuthService.verifyUser(email, password);

      const payload = {
        id: user.id,
        email: user.email,
      };

      const accessToken = request.server.jwt.sign(payload, { expiresIn: "1h" });
      const refreshToken = request.server.jwt.sign(payload, {
        expiresIn: "15d",
      });

      return reply.send({
        message: "Login successful",
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error: any) {
      if (error.message === "Invalid email or password") {
        return reply.status(401).send({ error: error.message });
      }

      request.server.log.error(error);
      return reply.status(500).send({ error: "Connect server fail" });
    }
  }

  // ===== Token Refresh Handler =====
  // Responsibility: รับ Refresh Token ตรวจสอบสถานะ และสร้าง Access Token ใหม่
  static async refresh(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { refreshToken } = request.body as { refreshToken: string };

      if (!refreshToken) {
        return reply.status(400).send({ error: "Refresh token is required" });
      }

      const decode = request.server.jwt.verify(refreshToken) as {
        id: string;
        email: string;
      };

      const newAccessToken = request.server.jwt.sign(
        { id: decode.id, email: decode.email },
        { expiresIn: "1h" },
      );

      return reply.send({ accessToken: newAccessToken });
    } catch (error) {
      return reply
        .status(401)
        .send({ error: "Invalid or expired refresh token" });
    }
  }

  // ===== Get Current User Profile (Me) =====
  // Responsibility: ส่งข้อมูลโปรไฟล์ล่าสุดของผู้ใช้กลับไป (ใช้งานได้เฉพาะคนที่มี Access Token ที่ถูกต้องเท่านั้น)
  static async getMe(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as { id: string; email: string };

      return reply.send({ user });
    } catch (error) {
      request.server.log.error(error);
      return reply.status(500).send({ error: "Connect server fail" });
    }
  }
}
