import { cn } from "../lib/cn";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-white/10", className)}
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function Stepper({
  steps,
  activeIndex,
  onStepChange
}: {
  steps: string[];
  activeIndex: number;
  onStepChange?: (index: number) => void;
}) {
  return (
    <div className="grid gap-3">
      <ProgressBar value={((activeIndex + 1) / steps.length) * 100} />
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Wizard progress">
        {steps.map((item, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;
          return (
            <button
              key={item}
              type="button"
              disabled={!onStepChange}
              onClick={() => onStepChange?.(index)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition",
                active || complete ? "border-white/40 bg-white/10 text-white" : "border-white/10 bg-white/5 text-text-soft"
              )}
              aria-current={active ? "step" : undefined}
            >
              {index + 1}. {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
