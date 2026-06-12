import type { ReactNode } from "react";
import { Info } from "lucide-react";

export function Tooltip({ content, children }: { content: string; children?: ReactNode }) {
  return (
    <span className="group relative inline-flex items-center">
      {children ?? (
        <button
          type="button"
          className="grid h-5 w-5 place-items-center rounded-full text-text-muted hover:text-text-primary"
          aria-label={content}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-full border border-white/10 bg-black p-3 text-xs leading-5 text-text-soft shadow-panel group-hover:block group-focus-within:block">
        {content}
      </span>
    </span>
  );
}
