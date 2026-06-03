import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DesignSystemPage from "./pages/DesignSystemPage";
import NotFoundPage from "./pages/NotFoundPage";
import HealthCheckPage from "./pages/HealthCheckPage";

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Design System */}
      <Route path="/design-system" element={<DesignSystemPage />} />

      {/* System Status */}
      <Route path="/health" element={<HealthCheckPage />} />

      {/* Wildcard 404 Page */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
