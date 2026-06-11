import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function CodeBlock({ className, ...props }: HTMLAttributes<HTMLPreElement>) {
  return <pre className={cn("max-h-[460px] overflow-auto rounded-lg border border-[var(--x-code-border)] bg-code p-4 font-mono text-xs leading-5 text-slate-300", className)} {...props} />;
}

export function JsonViewer({ value }: { value: unknown }) {
  return <CodeBlock>{JSON.stringify(value, null, 2)}</CodeBlock>;
}
