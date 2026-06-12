import { useState } from "react";
import { SignInPage } from "../components/ui/sign-in-flow-1";
import { useAuth } from "./auth";

type AuthMode = "login" | "register";

export function AuthPage({
  initialMode = "login",
  onAuthenticated
}: {
  initialMode?: AuthMode;
  onAuthenticated?: (mode: AuthMode) => void;
}) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [completedMode, setCompletedMode] = useState<AuthMode>(initialMode);

  async function submit(payload: { mode: AuthMode; email: string; password: string; name?: string; organizationName?: string }) {
    setLoading(true);
    setStatus(payload.mode === "login" ? "Signing in" : "Creating workspace");
    try {
      if (payload.mode === "login") {
        await login({ email: payload.email, password: payload.password });
      } else {
        await register({
          email: payload.email,
          password: payload.password,
          name: payload.name,
          organizationName: payload.organizationName
        });
      }
      setCompletedMode(payload.mode);
      setStatus("Authenticated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed");
      throw error;
    } finally {
      setLoading(false);
    }
  }

  return (
    <SignInPage
      mode={mode}
      loading={loading}
      status={status}
      onModeChange={(nextMode) => {
        setMode(nextMode);
        setStatus("");
      }}
      onSubmit={submit}
      onSuccessContinue={() => onAuthenticated?.(completedMode)}
    />
  );
}
