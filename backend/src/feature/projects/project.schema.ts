import { z } from "zod";

// ค่า default สำหรับ settings ของ project ใหม่
export const DEFAULT_PROJECT_SETTINGS = {
  resolution: "1080p",
  fps: 30,
  duration_ms: 0,
};

// 1. Schema สำหรับสร้าง Project ใหม่ (POST /projects)
export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(500).optional(),
  workspaceId: z.string().uuid("Invalid workspace ID"),
  settings: z
    .object({
      resolution: z.string().optional(),
      fps: z.number().optional(),
      duration_ms: z.number().optional(),
    })
    .optional(),
});

// 2. Schema สำหรับแก้ไข Project (PATCH /projects/:id)
export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    settings: z
      .object({
        resolution: z.string().optional(),
        fps: z.number().optional(),
        duration_ms: z.number().optional(),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
    path: [],
  });

// 3. Schema สำหรับ Query params ของ GET /projects
export const listProjectsSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// 4. Schema สำหรับบันทึก OperationLog (POST /projects/:id/versions)
export const createVersionSchema = z.object({
  operation_type: z.string().min(1, "Operation type is required"),
  payload: z.record(z.string(), z.unknown()),
  client_seq: z.number().int().min(0, "client_seq must be non-negative"),
});

// Export TypeScript types
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
