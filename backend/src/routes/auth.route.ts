import type { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller.js";
import { authExtractor } from "../middlewares/auth.middlewares.js";

export async function authRoutes(server: FastifyInstance) {
  server.post("/auth/register", AuthController.register);
  server.post("/auth/login", AuthController.login);
  server.post("/auth/refresh", AuthController.refresh);
  server.get("/auth/me", { preHandler: [authExtractor] }, AuthController.getMe);
}
