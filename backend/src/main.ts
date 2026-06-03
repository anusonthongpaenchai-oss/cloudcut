import Fastify from "fastify";
import cors from "@fastify/cors";
import healthRoutes from "./routes/health.js";

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


// Register routes
server.register(healthRoutes);

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
