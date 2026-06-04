import axios from "axios";

// ===== API Service =====
// Responsibility: สร้างตัวแทนของ Axios ที่ตั้งค่า Base URL ชี้ไปยัง Backend
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ===== Request Interceptor =====
// Responsibility: แนบ Access Token เข้าไปใน Header โดยหาจากกล่องไหนก็ได้ที่มี
api.interceptors.request.use((config) => {
  // หาจาก localStorage ก่อน ถ้าไม่เจอค่อยไปหาใน sessionStorage
  const token =
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ===== Response Interceptor =====
// Responsibility: ดักจับ Error 401 และจัดการ Refresh Token ให้ตรงกับสถานะ Remember Me
api.interceptors.response.use(
  (response) => response, // ถ้า Request สำเร็จ (Status 2xx) ให้ปล่อยผ่านปกติ
  async (error) => {
    const originalRequest = error.config;

    // ตรวจสอบว่าเป็น Error 401 (Unauthorized) และยังไม่ได้ทำการ Retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // 1. เช็กก่อนว่าผู้ใช้คนนี้กด Remember Me ไว้หรือไม่
        const isRemembered = !!localStorage.getItem("refreshToken");

        // 2. ดึง Refresh Token ออกมาจากกล่องไหนก็ได้ที่มี
        const refreshToken =
          localStorage.getItem("refreshToken") ||
          sessionStorage.getItem("refreshToken");

        if (!refreshToken) throw new Error("No refresh token available");

        // 3. ยิง API ไปขอ Access Token ใบใหม่
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const { data } = await axios.post(`${baseUrl}/auth/refresh`, {
          refreshToken,
        });

        // 4. ได้ใบใหม่มาแล้ว ต้องเซฟกลับไปที่เดิมให้ถูกต้อง!
        if (isRemembered) {
          // ถ้าเคยกด Remember ก็เซฟลง localStorage ทับของเก่า
          localStorage.setItem("accessToken", data.accessToken);
        } else {
          // ถ้าไม่ได้กด Remember ก็เซฟลง sessionStorage ชั่วคราวเหมือนเดิม
          sessionStorage.setItem("accessToken", data.accessToken);
        }

        // 5. เอาใบใหม่ไปใส่ใน Request เดิมที่เคยพัง แล้วยิงซ้ำอีกรอบ
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // กรณีที่ Refresh Token หมดอายุ หรือมีปัญหา ให้เคลียร์ข้อมูลทิ้งให้เกลี้ยงทั้ง 2 กล่อง
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");

        // บังคับเปลี่ยนหน้าไปที่ Login
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
