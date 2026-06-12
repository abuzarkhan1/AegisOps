import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function FormField({
  label,
  hint,
  error,
  children,
  className
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-xs font-semibold text-text-soft">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose">{error}</span> : hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}
