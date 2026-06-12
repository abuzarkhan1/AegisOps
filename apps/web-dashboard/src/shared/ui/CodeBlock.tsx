import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function CodeBlock({ className, ...props }: HTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      className={cn(
        "max-h-[460px] overflow-auto rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-xs leading-5 text-text-soft backdrop-blur-[2px]",
        className
      )}
      {...props}
    />
  );
}

export function JsonViewer({ value }: { value: unknown }) {
  return <CodeBlock>{JSON.stringify(value, null, 2)}</CodeBlock>;
}
