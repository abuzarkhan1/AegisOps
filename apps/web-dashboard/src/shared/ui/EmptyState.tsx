import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-panel-soft p-6 text-sm text-slate-400">
      <p className="font-semibold text-slate-200">{title}</p>
      {description ? <p className="mt-1 max-w-xl text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
