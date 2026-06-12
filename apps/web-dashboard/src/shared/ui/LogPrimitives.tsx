import type { ReactNode } from "react";
import { cn } from "../lib/cn";

const levelClasses: Record<string, string> = {
  fatal: "border-rose/50 bg-rose/10 text-rose",
  error: "border-rose/40 bg-rose/10 text-rose",
  warn: "border-amber/40 bg-amber/10 text-amber",
  info: "border-success/40 bg-success/10 text-success",
  debug: "border-white/10 bg-white/5 text-text-soft"
};

export function LogLevelBadge({ level }: { level?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase",
        levelClasses[level ?? ""] ?? levelClasses.debug
      )}
    >
      {level ?? "log"}
    </span>
  );
}

export function LogLine({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("font-mono text-xs leading-5 text-text-soft", className)}>{children}</div>;
}
