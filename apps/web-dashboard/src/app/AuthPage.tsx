import { FormEvent, useState } from "react";
import { Activity, LockKeyhole, RadioTower, UserPlus } from "lucide-react";
import { useAuth } from "./auth";
import { Button } from "../shared/ui/Button";
import { Card } from "../shared/ui/Card";
import { Input } from "../shared/ui/FormControls";

type AuthMode = "login" | "register";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setStatus(mode === "login" ? "Signing in" : "Creating account");
    try {
      if (mode === "login") {
        await login({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? "")
        });
      } else {
        await register({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          name: String(form.get("name") ?? ""),
          organizationName: String(form.get("organizationName") ?? "")
        });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-shell px-4 py-10 text-slate-100">
      <div className="w-full max-w-5xl">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md border border-mint/30 bg-mint/10">
            <RadioTower className="h-5 w-5 text-mint" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-white">AegisOps</h1>
            <p className="text-sm text-slate-400">AI-powered monitoring operations workspace</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
          <section className="rounded-lg border border-line bg-panel p-6 shadow-panel">
            <div className="flex items-center gap-2 text-mint">
              <Activity className="h-5 w-5" />
              <span className="text-sm font-semibold">Secure Operations Console</span>
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight text-white">
              Sign in to manage incidents, telemetry, deployments, notification routes, and AI investigations.
            </h2>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {["Tenant-scoped APIs", "JWT sessions", "Operational audit trail"].map((item) => (
                <div key={item} className="rounded-lg border border-line bg-panel-soft p-4 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <Card
            title={mode === "login" ? "Sign In" : "Create Account"}
            description={mode === "login" ? "Use your AegisOps account credentials." : "Create the first user and organization."}
          >
            <form onSubmit={submit} className="grid gap-3">
              {mode === "register" ? (
                <>
                  <Input name="name" placeholder="Your name" autoComplete="name" />
                  <Input name="organizationName" placeholder="Organization name" autoComplete="organization" />
                </>
              ) : null}
              <Input name="email" required type="email" placeholder="Email" autoComplete="email" />
              <Input name="password" required type="password" placeholder="Password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
              <Button type="submit" variant="primary" disabled={loading} icon={mode === "login" ? <LockKeyhole className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}>
                {mode === "login" ? "Sign In" : "Create Account"}
              </Button>
              <Button type="button" variant="ghost" disabled={loading} onClick={() => setMode((current) => current === "login" ? "register" : "login")}>
                {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
              </Button>
            </form>
            {status ? <p className="mt-3 text-sm text-slate-400">{status}</p> : null}
          </Card>
        </div>
      </div>
    </main>
  );
}
