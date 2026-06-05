import type { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller.js";
import { authExtractor } from "../../middlewares/auth.middleware.js";

export async function authRoutes(server: FastifyInstance) {
  server.post("/register", AuthController.register);
  server.post("/login", AuthController.login);
  server.post("/refresh", AuthController.refresh);
  server.get("/me", { preHandler: [authExtractor] }, AuthController.getMe);
}
