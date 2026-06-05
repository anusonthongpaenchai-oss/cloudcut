import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../config/db.js";
import type {
  AcceptInviteInput,
  CreateWorkspaceInput,
  InviteMemberInput,
  UpdateRoleInput,
} from "./workspace.schema.js";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateRoleSchema,
  acceptInviteSchema,
} from "./workspace.schema.js";
import crypto from "crypto";

// ===== 1. สร้าง Workspace (POST /workspaces) =====
export const createWorkspace = async (
  request: FastifyRequest<{ Body: CreateWorkspaceInput }>,
  reply: FastifyReply,
) => {
  try {
    const validateRequest = createWorkspaceSchema.safeParse(request.body);
    if (!validateRequest.success) {
      reply
        .status(400)
        .send({ error: validateRequest.error.issues[0]?.message });
      return;
    }

    const { name } = validateRequest.data;
    const userId = (request.user as any).id;

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;

    const workspace = await db.workspace.create({
      data: {
        name,
        slug,
        owner_id: userId,
        members: {
          create: {
            user_id: userId,
            role: "owner",
          },
        },
      },
      include: {
        members: true,
      },
    });

    reply
      .status(201)
      .send({ message: "Workspace created successfully", workspace });
    return;
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
    return;
  }
};

// ===== 2. ดูรายการ Workspace ของตัวเอง (GET /workspaces) =====
export const getWorkspaces = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const userId = (request.user as any).id;

    const workspaces = await db.workspace.findMany({
      where: {
        members: {
          some: {
            user_id: userId,
          },
        },
      },
      include: {
        members: {
          where: { user_id: userId },
          select: { role: true },
        },
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { updated_at: "desc" },
    });

    reply.status(200).send({ workspaces });
    return;
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
    return;
  }
};

// ===== 3. ดูรายละเอียด Workspace (GET /workspaces/:id) =====
export const getWorkspaceById = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  try {
    const { id } = request.params;

    const workspace = await db.workspace.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar_url: true },
            },
          },
        },
        projects: {
          orderBy: { updated_at: "desc" },
        },
      },
    });

    if (!workspace) {
      reply
        .status(404)
        .send({ error: "Not Found", message: "Workspace not found" });
      return;
    }

    reply.status(200).send({ workspace });
    return;
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
    return;
  }
};

// ===== 4. เชิญสมาชิกเข้า Workspace (POST /workspaces/:id/invite) =====
export const inviteMember = async (
  request: FastifyRequest<{ Params: { id: string }; Body: InviteMemberInput }>,
  reply: FastifyReply,
) => {
  try {
    const validateRequest = inviteMemberSchema.safeParse(request.body);
    if (!validateRequest.success) {
      reply
        .status(400)
        .send({ error: validateRequest.error.issues[0]?.message });
      return;
    }

    const { id: workspaceId } = request.params;
    const { email, role } = validateRequest.data;
    const inviterId = (request.user as any).id;

    const userToInvite = await db.user.findUnique({ where: { email } });
    if (!userToInvite) {
      reply.status(404).send({
        error: "Not Found",
        message: "User with this email not found",
      });
      return;
    }

    const existingMember = await db.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: userToInvite.id,
        },
      },
    });

    if (existingMember) {
      reply
        .status(400)
        .send({ error: "Bad Request", message: "User is already a member" });
      return;
    }

    const token = crypto.randomBytes(20).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await db.invitation.create({
      data: {
        workspace_id: workspaceId,
        email,
        role,
        token,
        invited_by: inviterId,
        expires_at: expiresAt,
      },
    });

    reply
      .status(201)
      .send({ message: "Invitation sent successfully", invitation });
    return;
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
    return;
  }
};

// ===== 5. แก้ไขสิทธิ์สมาชิก (PATCH /workspaces/:id/members/:userId) =====
export const updateMemberRole = async (
  request: FastifyRequest<{
    Params: { id: string; userId: string };
    Body: UpdateRoleInput;
  }>,
  reply: FastifyReply,
) => {
  try {
    const validateRequest = updateRoleSchema.safeParse(request.body);
    if (!validateRequest.success) {
      reply
        .status(400)
        .send({ error: validateRequest.error.issues[0]?.message });
      return;
    }

    const { id: workspaceId, userId: targetUserId } = request.params;
    const { role } = validateRequest.data;

    const targetMember = await db.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: targetUserId,
        },
      },
    });

    if (!targetMember) {
      reply.status(404).send({
        error: "Not Found",
        message: "Member not found in this workspace",
      });
      return;
    }

    if (targetMember.role === "owner") {
      reply.status(403).send({
        error: "Forbidden",
        message: "Cannot change the role of the workspace owner",
      });
      return;
    }

    const updatedMember = await db.workspaceMember.update({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: targetUserId,
        },
      },
      data: { role },
    });

    reply
      .status(200)
      .send({ message: "Member role updated", member: updatedMember });
    return;
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
    return;
  }
};

// ===== 6. เตะสมาชิกออกจาก Workspace (DELETE /workspaces/:id/members/:userId) =====
export const removeMember = async (
  request: FastifyRequest<{ Params: { id: string; userId: string } }>,
  reply: FastifyReply,
) => {
  try {
    const { id: workspaceId, userId: targetUserId } = request.params;

    const targetMember = await db.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: targetUserId,
        },
      },
    });

    if (!targetMember) {
      reply.status(404).send({
        error: "Not Found",
        message: "Member not found in this workspace",
      });
      return;
    }

    if (targetMember.role === "owner") {
      reply.status(403).send({
        error: "Forbidden",
        message: "Cannot remove the workspace owner",
      });
      return;
    }

    await db.workspaceMember.delete({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: targetUserId,
        },
      },
    });

    reply.status(200).send({ message: "Member removed successfully" });
    return;
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
    return;
  }
};

// ===== 7. ยอมรับคำเชิญ (POST /workspaces/accept-invite) =====
export const acceptInvite = async (
  request: FastifyRequest<{ Body: AcceptInviteInput }>,
  reply: FastifyReply,
) => {
  try {
    const validateRequest = acceptInviteSchema.safeParse(request.body);
    if (!validateRequest.success) {
      reply
        .status(400)
        .send({ error: validateRequest.error.issues[0]?.message });
      return;
    }

    const { token } = validateRequest.data;
    const userId = (request.user as any).id;

    // หา Invitation จาก Token
    const invitation = await db.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      reply
        .status(404)
        .send({ error: "Not Found", message: "Invalid invitation token" });
      return;
    }

    // เช็กสถานะว่าถูกใช้ไปแล้วหรือยัง
    if (invitation.status !== "pending") {
      reply
        .status(400)
        .send({
          error: "Bad Request",
          message: "Invitation is already accepted or expired",
        });
      return;
    }

    // เช็กวันหมดอายุ
    if (new Date() > invitation.expires_at) {
      // (Optional) แอบเปลี่ยนสถานะให้เป็น expired ใน DB
      await db.invitation.update({
        where: { id: invitation.id },
        data: { status: "expired" },
      });
      reply
        .status(400)
        .send({ error: "Bad Request", message: "Invitation has expired" });
      return;
    }

    // เช็กว่าอีเมลของคนที่ล็อกอิน ตรงกับอีเมลที่ถูกเชิญไหม (ดึงอีเมลจาก DB มาเทียบ)
    const currentUser = await db.user.findUnique({ where: { id: userId } });
    if (currentUser?.email !== invitation.email) {
      reply
        .status(403)
        .send({
          error: "Forbidden",
          message: "This invitation was sent to a different email address",
        });
      return;
    }

    // เช็กว่าอยู่ใน Workspace นี้อยู่แล้วหรือไม่ (เผื่อกรณีบั๊ก)
    const existingMember = await db.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: invitation.workspace_id,
          user_id: userId,
        },
      },
    });

    if (existingMember) {
      reply
        .status(400)
        .send({
          error: "Bad Request",
          message: "You are already a member of this workspace",
        });
      return;
    }

    // ทำ Transaction: อัปเดตสถานะคำเชิญ + เพิ่มคนเข้า Workspace
    await db.$transaction([
      db.invitation.update({
        where: { id: invitation.id },
        data: { status: "accepted" },
      }),
      db.workspaceMember.create({
        data: {
          workspace_id: invitation.workspace_id,
          user_id: userId,
          role: invitation.role,
        },
      }),
    ]);

    reply.status(200).send({ message: "Successfully joined the workspace" });
    return;
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
    return;
  }
};
