import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <Breadcrumbs items={["AegisOps", eyebrow]} /> : null}
        <h1 className="mt-1 truncate text-2xl font-bold leading-8 text-white">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
