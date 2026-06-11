import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function Tabs({
  tabs,
  active,
  onChange
}: {
  tabs: Array<{ id: string; label: string; content?: ReactNode }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <div role="tablist" className="inline-flex rounded-full border border-line bg-panel-soft p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn("h-8 rounded-full px-3 text-xs font-semibold transition", active === tab.id ? "bg-mint text-black" : "text-slate-400 hover:text-white")}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((tab) => tab.id === active)?.content}
    </div>
  );
}
