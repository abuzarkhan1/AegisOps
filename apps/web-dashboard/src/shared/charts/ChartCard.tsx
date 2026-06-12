import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ChartSkeleton } from "../ui/LoadingSkeleton";

export type ChartPoint = {
  label: string;
  value: number;
};

type ChartCardProps = {
  title: string;
  description?: string;
  loading?: boolean;
  empty?: boolean;
  children: ReactNode;
};

type SeriesChartProps = {
  title: string;
  description?: string;
  data: ChartPoint[];
  loading?: boolean;
  empty?: boolean;
  color?: string;
};

export function ChartCard({ title, description, loading, empty, children }: ChartCardProps) {
  return (
    <Card title={title} description={description}>
      {loading ? <ChartSkeleton className="h-44" /> : empty ? <EmptyState title="No chart data available" /> : children}
    </Card>
  );
}

const clampMax = (data: ChartPoint[]) => Math.max(...data.map((point) => point.value), 1);

export function BarChartPanel({ title, description, data, loading, empty, color = "var(--x-chart-1)" }: SeriesChartProps) {
  const max = clampMax(data);

  return (
    <ChartCard title={title} description={description} loading={loading} empty={empty ?? data.length === 0}>
      <div className="h-52">
        <svg role="img" aria-label={title} viewBox="0 0 640 220" className="h-full w-full overflow-visible">
          {[0, 1, 2, 3].map((line) => {
            const y = 24 + line * 44;
            return <line key={line} x1="36" x2="624" y1={y} y2={y} stroke="var(--x-border-soft)" strokeWidth="1" />;
          })}
          {data.map((point, index) => {
            const barGap = 10;
            const slot = 588 / data.length;
            const width = Math.max(8, slot - barGap);
            const height = Math.max(4, (point.value / max) * 150);
            const x = 36 + index * slot + barGap / 2;
            const y = 176 - height;
            return (
              <g key={`${point.label}-${index}`}>
                <rect x={x} y={y} width={width} height={height} rx="5" fill={color} opacity="0.9">
                  <title>{`${point.label}: ${point.value}`}</title>
                </rect>
                {index % Math.ceil(data.length / 6) === 0 ? (
                  <text x={x + width / 2} y="206" textAnchor="middle" fill="var(--x-text-muted)" fontSize="11">
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          <text x="36" y="18" fill="var(--x-text-muted)" fontSize="11">
            {max}
          </text>
          <text x="36" y="192" fill="var(--x-text-muted)" fontSize="11">
            0
          </text>
        </svg>
      </div>
    </ChartCard>
  );
}

export function LineChartPanel({ title, description, data, loading, empty, color = "var(--x-chart-2)" }: SeriesChartProps) {
  const max = clampMax(data);
  const width = 600;
  const height = 150;
  const points = data
    .map((point, index) => {
      const x = 36 + (index / Math.max(data.length - 1, 1)) * width;
      const y = 176 - (point.value / max) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <ChartCard title={title} description={description} loading={loading} empty={empty ?? data.length === 0}>
      <div className="h-52">
        <svg role="img" aria-label={title} viewBox="0 0 672 220" className="h-full w-full overflow-visible">
          {[0, 1, 2, 3].map((line) => {
            const y = 24 + line * 44;
            return <line key={line} x1="36" x2="636" y1={y} y2={y} stroke="var(--x-border-soft)" strokeWidth="1" />;
          })}
          <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((point, index) => {
            const x = 36 + (index / Math.max(data.length - 1, 1)) * width;
            const y = 176 - (point.value / max) * height;
            return (
              <circle key={`${point.label}-${index}`} cx={x} cy={y} r="4" fill={color}>
                <title>{`${point.label}: ${point.value}`}</title>
              </circle>
            );
          })}
          <text x="36" y="18" fill="var(--x-text-muted)" fontSize="11">
            {max}
          </text>
          <text x="36" y="192" fill="var(--x-text-muted)" fontSize="11">
            0
          </text>
        </svg>
      </div>
    </ChartCard>
  );
}

export function DonutChartPanel({ title, description, data, loading, empty }: SeriesChartProps) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const palette = ["var(--x-chart-1)", "var(--x-chart-2)", "var(--x-chart-3)", "var(--x-chart-4)", "var(--x-chart-5)"];
  let offset = 25;

  return (
    <ChartCard title={title} description={description} loading={loading} empty={empty ?? (data.length === 0 || total === 0)}>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
        <svg role="img" aria-label={title} viewBox="0 0 180 180" className="h-44 w-44">
          <circle cx="90" cy="90" r="58" fill="none" stroke="var(--x-border-soft)" strokeWidth="22" />
          {data.map((point, index) => {
            const dash = (point.value / total) * 365;
            const segment = (
              <circle
                key={point.label}
                cx="90"
                cy="90"
                r="58"
                fill="none"
                stroke={palette[index % palette.length]}
                strokeWidth="22"
                strokeDasharray={`${dash} ${365 - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 90 90)"
              >
                <title>{`${point.label}: ${point.value}`}</title>
              </circle>
            );
            offset -= dash;
            return segment;
          })}
          <text x="90" y="84" textAnchor="middle" fill="var(--x-text-strong)" fontSize="22" fontWeight="700">
            {total}
          </text>
          <text x="90" y="104" textAnchor="middle" fill="var(--x-text-muted)" fontSize="11">
            total
          </text>
        </svg>
        <div className="grid gap-2">
          {data.map((point, index) => (
            <div
              key={point.label}
              className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2 text-text-soft">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: palette[index % palette.length] }} />
                <span className="truncate">{point.label}</span>
              </span>
              <span className="font-semibold text-white">{point.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

export function Sparkline({ title, data, color = "var(--x-chart-1)" }: { title: string; data: ChartPoint[]; color?: string }) {
  const max = clampMax(data);
  const points = data
    .map((point, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 120;
      const y = 38 - (point.value / max) * 34;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg role="img" aria-label={title} viewBox="0 0 120 42" className="h-10 w-28 overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
