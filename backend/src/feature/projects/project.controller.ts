import type { FastifyReply, FastifyRequest } from "fastify";
import { ProjectService } from "./project.service.js";
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  createVersionSchema,
} from "./project.schema.js";

export class ProjectController {
  // ===== 1. สร้าง Project ใหม่ (POST /projects) =====
  static async createProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = createProjectSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message });
      }

      const userId = request.user.id;
      const project = await ProjectService.createProject({
        name: parsed.data.name,
        description: parsed.data.description,
        workspaceId: parsed.data.workspaceId,
        settings: parsed.data.settings,
        userId,
      });

      return reply
        .status(201)
        .send({ message: "Project created successfully", project });
    } catch (error: any) {
      if (error.message?.startsWith("Forbidden")) {
        return reply
          .status(403)
          .send({ error: "Forbidden", message: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 2. ดึงรายการ Project (GET /projects?workspaceId=X) =====
  static async listProjects(request: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = listProjectsSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message });
      }

      const userId = request.user.id;
      const result = await ProjectService.listProjects({
        workspaceId: parsed.data.workspaceId,
        cursor: parsed.data.cursor,
        limit: parsed.data.limit,
        userId,
      });

      return reply.status(200).send(result);
    } catch (error: any) {
      if (error.message?.startsWith("Forbidden")) {
        return reply
          .status(403)
          .send({ error: "Forbidden", message: error.message });
      }
      if (error.message === "Invalid cursor format") {
        return reply.status(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 3. ดึง Project พร้อม Full Timeline (GET /projects/:id) =====
  static async getProjectById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      const project = await ProjectService.getProjectById({ projectId: id });

      return reply.status(200).send({ project });
    } catch (error: any) {
      if (error.message?.startsWith("Not Found")) {
        return reply
          .status(404)
          .send({ error: "Not Found", message: "Project not found" });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 4. อัปเดต Project (PATCH /projects/:id) =====
  static async updateProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = updateProjectSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message });
      }

      const { id } = request.params as { id: string };

      const project = await ProjectService.updateProject({
        projectId: id,
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          settings: parsed.data.settings as Record<string, unknown> | undefined,
        },
      });

      return reply
        .status(200)
        .send({ message: "Project updated successfully", project });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 5. Soft Delete Project (DELETE /projects/:id) =====
  static async deleteProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      await ProjectService.softDeleteProject({ projectId: id });

      return reply
        .status(200)
        .send({ message: "Project deleted successfully" });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 6. Duplicate Project (POST /projects/:id/duplicate) =====
  static async duplicateProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user.id;

      const newProject = await ProjectService.duplicateProject({
        projectId: id,
        userId,
      });

      return reply.status(201).send({
        message: "Project duplicated successfully",
        project: newProject,
      });
    } catch (error: any) {
      if (error.message?.startsWith("Not Found")) {
        return reply
          .status(404)
          .send({ error: "Not Found", message: "Project not found" });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 7. ดึง Version History (GET /projects/:id/versions) =====
  static async getProjectVersions(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = request.params as { id: string };

      const versions = await ProjectService.getVersions({ projectId: id });

      return reply.status(200).send({ versions });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }

  // ===== 8. บันทึก Operation ใหม่ (POST /projects/:id/versions) =====
  static async createProjectVersion(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const parsed = createVersionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message });
      }

      const { id } = request.params as { id: string };
      const userId = request.user.id;

      const version = await ProjectService.createVersion({
        projectId: id,
        userId,
        ...parsed.data,
      });

      return reply.status(201).send({ message: "Version created", version });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }
}
