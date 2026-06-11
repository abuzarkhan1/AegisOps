import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ChartSkeleton } from "../ui/LoadingSkeleton";

export function ChartCard({
  title,
  loading,
  empty,
  children
}: {
  title: string;
  loading?: boolean;
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <Card title={title}>
      {loading ? <ChartSkeleton className="h-44" /> : empty ? <EmptyState title="No chart data available" /> : children}
    </Card>
  );
}

export const LineChartPanel = ChartCard;
export const BarChartPanel = ChartCard;
export const DonutChartPanel = ChartCard;
export const Sparkline = ChartCard;
