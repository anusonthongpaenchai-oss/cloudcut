import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { randomUUID } from "crypto";
import { apiRouter } from "./router/router.js";
import { AppError } from "./lib/errors.js";

// ===== Server Instance =====
// Responsibility: จัดการเว็บเซิร์ฟเวอร์และ Routing

const server = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

// Enable CORS
server.register(cors, {
  origin: true,
});

// Auth JWT
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
});

// ===== Centralized Error Handler =====
// Responsibility: จัดการ format error response + requestId ให้อัตโนมัติ
// ใช้กับ timeline module ใหม่ที่ throw AppError แทน try/catch
server.setErrorHandler((error, _request, reply) => {
  const requestId = `req_${randomUUID()}`;

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.error,
      message: error.message,
      requestId,
    });
  }

  // Zod / Fastify validation errors — cast เป็น FastifyError เพื่อเข้าถึง statusCode
  const fastifyErr = error as { statusCode?: number; message: string };
  if (fastifyErr.statusCode === 400) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: fastifyErr.message,
      requestId,
    });
  }

  // Fallback for unexpected errors
  reply.log.error(error);
  return reply.status(500).send({
    statusCode: 500,
    error: "Internal Server Error",
    message: "An unexpected error occurred",
    requestId,
  });
});

// ===== Register Routes =====

// Main API Router
server.register(apiRouter);

const start = async () => {
  try {
    await server.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Fastify Server is running on http://localhost:3000");
  } catch (error) {
    console.error("Fatal Error: Could not start server", error);
    process.exit(1);
  }
};

start();
