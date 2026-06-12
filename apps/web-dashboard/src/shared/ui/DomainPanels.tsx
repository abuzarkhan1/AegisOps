import type { ReactNode } from "react";
import { Card } from "./Card";
import { DataTable, type DataTableColumn } from "../table/DataTable";

export function AIInsightPanel({ children }: { children: ReactNode }) {
  return (
    <Card title="AI Insight" className="border-ai/30 bg-ai/10">
      {children}
    </Card>
  );
}

export function IncidentTimeline({ events }: { events: Array<{ id?: string; title: string; timestamp?: string }> }) {
  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div key={event.id ?? index} className="border-l border-white/10 pl-3">
          <p className="text-sm font-semibold text-white">{event.title}</p>
          {event.timestamp ? <p className="text-xs text-text-muted">{event.timestamp}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function RoutePerformanceTable<T extends { id?: string }>({ rows, columns }: { rows: T[]; columns: Array<DataTableColumn<T>> }) {
  return <DataTable rows={rows} columns={columns} emptyTitle="No route performance data" />;
}

export function DeploymentImpactCard({ children }: { children: ReactNode }) {
  return <Card title="Deployment Impact">{children}</Card>;
}
