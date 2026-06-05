import * as argon2 from "argon2";
import { UserRepository } from "../../repositories/user.repository.js";

export class AuthService {
  // ===== Registration Logic =====
  // Responsibility: ตรวจสอบความถูกต้องของข้อมูลและเข้ารหัสผ่านด้วย Argon2
  static async registerUser(email: string, password: string, name: string) {
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      throw new Error("Email already exists");
    }

    const password_hash = await argon2.hash(password);
    return UserRepository.create({ email, name, password_hash });
  }

  // ===== Authentication Logic =====
  // Responsibility: ตรวจสอบความถูกต้องของอีเมลและรหัสผ่านเทียบกับ Hash ของ Argon2
  static async verifyUser(email: string, password: string) {
    const user = await UserRepository.findByEmail(email);

    if (!user || !user.password_hash) {
      throw new Error("Invalid email or password");
    }

    const isValid = await argon2.verify(user.password_hash, password);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    return user;
  }
}
