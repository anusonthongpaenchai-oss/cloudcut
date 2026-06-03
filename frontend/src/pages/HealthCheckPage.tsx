import { useEffect, useState } from "react";
import {
  Activity,
  Server,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";

interface HealthStatus {
  status: string;
  database: string;
}

export default function HealthCheckPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const checkHealth = () => {
    setLoading(true);
    setError(null);
    setHealth(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let ignore = false;

    const fetchHealth = async () => {
      try {
        const response = await api.get("/health");
        if (!ignore) {
          setHealth(response.data);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to connect to backend. Is it running on port 3000?",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchHealth();

    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-4">
      <div className="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-md overflow-hidden rounded-2xl border shadow-xl duration-500">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <Server className="text-primary h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">System Status</h1>
          </div>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="hover:bg-muted rounded-full p-2 transition-colors disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw
              className={`text-muted-foreground h-5 w-5 ${loading ? "text-primary animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* Status Indicator */}
          <div className="flex flex-col items-center justify-center py-6">
            {loading ? (
              <div className="relative">
                <div className="bg-primary/20 absolute inset-0 animate-pulse rounded-full blur-xl"></div>
                <Activity className="text-primary relative z-10 h-16 w-16 animate-pulse" />
                <p className="text-muted-foreground mt-4 animate-pulse font-medium">
                  Checking connection...
                </p>
              </div>
            ) : error ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center text-center duration-500">
                <div className="bg-destructive/10 mb-4 flex h-20 w-20 items-center justify-center rounded-full">
                  <XCircle className="text-destructive h-10 w-10" />
                </div>
                <h2 className="text-destructive mb-2 text-2xl font-bold">
                  Connection Failed
                </h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center text-center duration-500">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-emerald-500">
                  All Systems Operational
                </h2>
                <p className="text-muted-foreground">
                  Successfully connected to the backend.
                </p>
              </div>
            )}
          </div>

          {/* Details Section */}
          {!loading && (health || error) && (
            <div className="bg-background border-border space-y-3 rounded-xl border p-4">
              <h3 className="text-muted-foreground mb-4 text-sm font-semibold tracking-wider uppercase">
                Diagnostic Details
              </h3>

              <div className="border-border/50 flex items-center justify-between border-b py-2">
                <span className="text-foreground/80 text-sm">API Server</span>
                <span
                  className={`text-sm font-medium ${health?.status === "OK" ? "text-emerald-500" : "text-destructive"}`}
                >
                  {health?.status === "OK" ? "Online" : "Offline"}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-foreground/80 text-sm">Database</span>
                <span
                  className={`text-sm font-medium ${health?.database === "Connected" ? "text-emerald-500" : "text-destructive"}`}
                >
                  {health?.database === "Connected"
                    ? "Connected"
                    : "Disconnected"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
