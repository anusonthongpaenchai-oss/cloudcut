import type { FastifyPluginAsync } from "fastify";
import { db } from "../config/db.js";

const healthRoutes: FastifyPluginAsync = async (server) => {
  server.get("/health", async (request, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return reply.send({
        status: "OK",
        database: "Connected",
      });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({
        status: "ERROR",
        database: "Disconnected",
      });
    }
  });
};

export default healthRoutes;
