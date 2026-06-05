import type { FastifyInstance } from "fastify";
import healthRoutes from "../feature/health/health.js";
import { authRoutes } from "../feature/auth/auth.routes.js";
import { workspaceRoutes } from "../feature/workspaces/workspace.routes.js";
import { projectRoutes } from "../feature/projects/project.routes.js";

export const apiRouter = async (server: FastifyInstance) => {
  // Health Check
  server.register(healthRoutes);

  // Auth Routes
  server.register(authRoutes, { prefix: "/auth" });

  // Workspace Routes
  server.register(workspaceRoutes, { prefix: "/workspaces" });

  // Project Routes
  server.register(projectRoutes, { prefix: "/projects" });
};
