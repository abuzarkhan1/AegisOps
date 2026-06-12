import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

type BadgeTone = "default" | "primary" | "success" | "warning" | "danger" | "ai" | "muted";

const tones: Record<BadgeTone, string> = {
  default: "border-white/10 bg-white/5 text-text-soft",
  primary: "border-white/30 bg-white/10 text-white",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-amber/40 bg-amber/10 text-amber",
  danger: "border-rose/40 bg-rose/10 text-rose",
  ai: "border-ai/40 bg-ai/10 text-ai",
  muted: "border-white/10 bg-white/5 text-text-muted"
};

export function Badge({ className, tone = "default", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const tone: BadgeTone =
    status === "active" || status === "connected" || status === "ok" || status === "healthy"
      ? "success"
      : status === "critical" || status === "revoked" || status === "offline" || status === "down"
        ? "danger"
        : status === "degraded" || status === "warning" || status === "stale"
          ? "warning"
          : "default";
  return <Badge tone={tone}>{status ?? "unknown"}</Badge>;
}

export function SeverityBadge({ severity }: { severity?: string }) {
  const tone: BadgeTone = severity === "critical" ? "danger" : severity === "high" ? "warning" : severity === "low" ? "success" : "primary";
  return <Badge tone={tone}>{severity ?? "medium"}</Badge>;
}

export const HealthBadge = StatusBadge;

export function ServiceTypeBadge({ type }: { type?: string }) {
  return <Badge tone="muted">{type ?? "service"}</Badge>;
}

export function EnvironmentBadge({ environment }: { environment?: string }) {
  return <Badge tone={environment === "production" ? "primary" : "default"}>{environment ?? "env"}</Badge>;
}
