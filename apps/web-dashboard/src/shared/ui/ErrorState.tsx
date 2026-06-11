import { RotateCcw } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({
  title = "Something went wrong.",
  detail,
  onRetry,
  onBack
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="rounded-lg border border-rose/30 bg-rose/10 p-5 text-sm text-slate-300">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {detail ? <p className="mt-2 max-w-2xl text-slate-400">{detail}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry ? <Button type="button" variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={onRetry}>Retry</Button> : null}
        {onBack ? <Button type="button" variant="secondary" onClick={onBack}>Back to dashboard</Button> : null}
      </div>
    </div>
  );
}
