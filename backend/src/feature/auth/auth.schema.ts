import { z } from "zod";

// ===== Auth Validation Schemas =====
// Responsibility: กำหนดรูปแบบและกฎเกณฑ์ของข้อมูล (Payload) ที่อนุญาตให้ส่งเข้ามา

export const registerSchema = z.object({
    email: z
        .string()
        .email("Invalid email address"),
    password: z
        .string()
        .min(6, "Password must be at least 6 characters long"),
    name: z
        .string()
        .min(3, "Name must be at least 3 characters long")
        .max(30, "Name must be at most 30 characters long"),
});

export const loginSchema = z.object({
    email: z
        .string()
        .email("Invalid email format"),
    password: z
        .string()
        .min(1, "Password must be at least 1 characters long"),
});
