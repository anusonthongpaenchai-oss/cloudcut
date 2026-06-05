import "@fastify/jwt";

// ขยาย Fastify type declarations เพื่อให้ request.user มี type ที่ถูกต้อง
// ทำให้ไม่ต้องใช้ (request.user as any).id ทั่ว codebase
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; email: string };
    user: { id: string; email: string };
  }
}
