import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  action?: ReactNode;
};

export function Card({ title, description, action, children, className, ...props }: CardProps) {
  return (
    <section className={cn("rounded-lg border border-line bg-panel p-4 shadow-panel", className)} {...props}>
      {title || description || action ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="truncate text-sm font-semibold text-white">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs text-text-soft">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase text-text-muted">{label}</p>
      <p className="mt-2 text-[28px] font-bold leading-[34px] text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-text-soft">{detail}</p> : null}
    </Card>
  );
}

export const MetricCard = StatCard;
export const InsightCard = Card;
export const HealthCard = Card;
