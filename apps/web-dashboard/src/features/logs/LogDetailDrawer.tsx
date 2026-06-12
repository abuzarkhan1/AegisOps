import type { ReactNode } from "react";
import { X } from "lucide-react";
import { CodeBlock, JsonViewer } from "../../shared/ui/CodeBlock";
import { IconButton } from "../../shared/ui/IconButton";
import { LogLevelBadge, LogLine } from "../../shared/ui/LogPrimitives";

type LogDetailDrawerProps = {
  log: any;
  onClose: () => void;
};

export function LogDetailDrawer({ log, onClose }: LogDetailDrawerProps) {
  return (
    <aside className="w-full aegis-glass rounded-2xl p-6 shadow-panel lg:w-96">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="font-semibold text-white">Log Entry Details</h3>
        <IconButton label="Close log details" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="space-y-4">
        <Detail label="Timestamp">{new Date(log.timestamp).toLocaleString()}</Detail>
        <Detail label="Service Name" strong>
          {log.serviceName}
        </Detail>
        <Detail label="Environment">{log.environment}</Detail>
        <div>
          <p className="text-[10px] font-bold uppercase text-text-muted">Level</p>
          <div className="mt-1">
            <LogLevelBadge level={log.level} />
          </div>
        </div>
        <Detail label="Trace ID" mono>
          {log.traceId || "-"}
        </Detail>
        <Detail label="Request ID" mono>
          {log.requestId || "-"}
        </Detail>
        <div className="grid grid-cols-3 gap-2">
          <Detail label="Route" mono>
            {log.route || log.metadata?.route || "-"}
          </Detail>
          <Detail label="Status" mono>
            {log.statusCode || log.metadata?.statusCode || "-"}
          </Detail>
          <Detail label="Duration" mono>
            {log.durationMs || log.metadata?.durationMs || "-"}ms
          </Detail>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-text-muted">Message</p>
          <CodeBlock className="mt-1 text-rose">{log.message}</CodeBlock>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase text-text-muted">Metadata JSON</p>
          <JsonViewer value={log.metadata ?? {}} />
        </div>
      </div>
    </aside>
  );
}

function Detail({ label, children, mono, strong }: { label: string; children: ReactNode; mono?: boolean; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-text-muted">{label}</p>
      <LogLine className={`${mono ? "" : "font-sans"} ${strong ? "font-semibold text-white" : ""}`}>{children}</LogLine>
    </div>
  );
}
