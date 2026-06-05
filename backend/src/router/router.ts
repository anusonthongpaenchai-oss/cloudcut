import type { FastifyInstance } from "fastify";
import healthRoutes from "../feature/health/health.js";
import { authRoutes } from "../feature/auth/auth.routes.js";
import { workspaceRoutes } from "../feature/workspaces/workspace.routes.js";
import { projectRoutes } from "../feature/projects/project.routes.js";
import { assetRoutes } from "../feature/assets/asset.routes.js";
import { exportRoutes } from "../feature/exports/export.routes.js";
import { collaborationRoutes } from "../feature/collaboration/collaboration.routes.js";

export const apiRouter = async (server: FastifyInstance) => {
  // Health Check
  server.register(healthRoutes);

  // Auth Routes
  server.register(authRoutes, { prefix: "/auth" });

  // Workspace Routes
  server.register(workspaceRoutes, { prefix: "/workspaces" });

  // Project Routes
  server.register(projectRoutes, { prefix: "/projects" });

  // Asset Routes
  server.register(assetRoutes, { prefix: "/assets" });

  // Export Routes (register at root — mixed prefixes: /projects/:id/exports & /exports/:id)
  server.register(exportRoutes);

  // Collaboration Routes (register at root — mixed prefixes: /pusher/auth & /projects/:id/operations)
  server.register(collaborationRoutes);
};
