import { AuthPage } from "../../app/AuthPage";

export function LoginPage({ onAuthenticated }: { onAuthenticated?: (mode: "login" | "register") => void }) {
  return <AuthPage initialMode="login" onAuthenticated={onAuthenticated} />;
}

export function RegisterPage({ onAuthenticated }: { onAuthenticated?: (mode: "login" | "register") => void }) {
  return <AuthPage initialMode="register" onAuthenticated={onAuthenticated} />;
}
