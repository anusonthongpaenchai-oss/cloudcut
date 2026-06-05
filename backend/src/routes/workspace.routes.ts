import type { FastifyInstance } from "fastify";
import {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  inviteMember,
  updateMemberRole,
  removeMember,
  acceptInvite,
} from "../controllers/workspace.controller.js";
import { authExtractor } from "../middlewares/auth.middlewares.js";
import { requireWorkspaceRole } from "../middlewares/workspace.schema.js";
import type {
  AcceptInviteInput,
  InviteMemberInput,
  UpdateRoleInput,
} from "../schemas/workspace.schema.js";

export const workspaceRoutes = async (fastify: FastifyInstance) => {
  fastify.addHook("preHandler", authExtractor);
  fastify.post("/", createWorkspace);
  fastify.get("/", getWorkspaces);

  fastify.post<{ Body: AcceptInviteInput }>("/accept-invite", acceptInvite);

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [
        requireWorkspaceRole(["owner", "admin", "editor", "viewer"]),
      ],
    },
    getWorkspaceById,
  );

  fastify.post<{ Params: { id: string }; Body: InviteMemberInput }>(
    "/:id/invite",
    { preHandler: [requireWorkspaceRole(["owner", "admin"])] },
    inviteMember,
  );

  fastify.patch<{
    Params: { id: string; userId: string };
    Body: UpdateRoleInput;
  }>(
    "/:id/members/:userId",
    { preHandler: [requireWorkspaceRole(["owner", "admin"])] },
    updateMemberRole,
  );

  fastify.delete<{ Params: { id: string; userId: string } }>(
    "/:id/members/:userId",
    { preHandler: [requireWorkspaceRole(["owner"])] },
    removeMember,
  );
};
