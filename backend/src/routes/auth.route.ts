import type { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller.js";
import { authExtractor } from "../middlewares/auth.middlewares.js";

export async function authRoutes(server: FastifyInstance) {
  server.post("/register", AuthController.register);
  server.post("/login", AuthController.login);
  server.post("/refresh", AuthController.refresh);
  server.get("/me", { preHandler: [authExtractor] }, AuthController.getMe);
}
