import { z } from "zod";

// 1. ตรวจสอบข้อมูลตอนสร้าง Workspace (POST /workspaces)
export const createWorkspaceSchema = z.object({
  name: z.string().min(3, "Workspace name is required").max(30),
});

// 2. ตรวจสอบข้อมูลตอนเชิญคนเข้า Workspace (POST /workspaces/:id/invite)
export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "editor", "viewer"], {
    message: "Role must be admin, editor, or viewer",
  }),
});

// 3. ตรวจสอบข้อมูลตอนเปลี่ยนสิทธิ์ (PATCH /workspaces/:id/members/:userId)
export const updateRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"], {
    message: "Role must be admin, editor, or viewer",
  }),
});

// 4. ตรวจสอบข้อมูลตอนกดยอมรับคำเชิญ (POST /workspaces/accept-invite)
export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// Export Type ไปให้ TypeScript รู้จักด้วย
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
