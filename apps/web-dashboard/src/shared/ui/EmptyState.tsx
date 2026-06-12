import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-text-soft backdrop-blur-[2px]">
      <p className="font-semibold text-text-primary">{title}</p>
      {description ? <p className="mt-1 max-w-xl text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
