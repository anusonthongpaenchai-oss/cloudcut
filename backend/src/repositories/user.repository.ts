import { db } from "../config/db.js";

export class UserRepository {
  // ===== Data Access: User =====
  // Responsibility: จัดการการเข้าถึงข้อมูล (Database operations) ทั้งหมดของ User
  // ใช้ unique constraint ของ email เพื่อเช็กบัญชีซ้ำ
  static async findByEmail(email: string) {
    return db.user.findUnique({ where: { email } });
  }

  // Responsibility: บันทึกข้อมูล User ใหม่ลงฐานข้อมูล
  static async create(data: any) {
    return db.user.create({ data });
  }
}
