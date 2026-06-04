import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import api from "../services/api";

// กำหนดรูปร่างของ User ให้ตรงกับที่ Backend ส่งมา
interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    accessToken: string,
    refreshToken: string,
    userData: User,
    rememberMe: boolean,
  ) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ===== Auto Login on Load =====
  // Responsibility: ตอนเปิดเว็บขึ้นมาครั้งแรก ให้เช็กว่ามี Token ไหม ถ้ามีให้ยิงไปถาม Backend ว่า Token ยังใช้ได้ไหม
  useEffect(() => {
    const fetchMe = async () => {
      const token =
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("accessToken");
      if (token) {
        try {
          // api.get จะวิ่งผ่าน Interceptor ที่เราเขียนไว้ ถ้า Token หมดอายุมันจะแอบไป Refresh ให้เอง
          const { data } = await api.get("/auth/me");
          setUser(data.user);
        } catch {
          // ถ้า Refresh ไม่ผ่าน (Token เก่าเกินไป) Interceptor จะลบ Token และเตะไปหน้า login ให้แล้ว
          setUser(null);
        }
      }
      setLoading(false);
    };

    fetchMe();
  }, []);

  // ===== Login Action =====
  // Responsibility: รับข้อมูลจากการหน้าฟอร์ม Login เพื่อเซฟลงเครื่องและอัปเดต State
  const login = (
    accessToken: string,
    refreshToken: string,
    userData: User,
    rememberMe: boolean,
  ) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem("accessToken", accessToken);
    storage.setItem("refreshToken", refreshToken);
    setUser(userData);
  };

  // ===== Logout Action =====
  // Responsibility: เคลียร์ข้อมูลทั้งหมดและรีเฟรชระบบ
  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook เพื่อให้หน้าอื่นๆ เรียกใช้ Context ได้ง่ายๆ
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
