import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-headline-1 text-primary mb-4 font-medium">
          CloudCut
        </h1>
        <h2 className="text-headline-2 text-primary mb-4 font-medium">
          SaaS Video Editor
        </h2>
        <Button onClick={() => navigate("/health")} variant="secondary">
          Health Check
        </Button>
        <Button onClick={() => navigate("/design-system")} variant="default">
          Design System
        </Button>
      </div>
    </div>
  );
}

export default LoginPage;
