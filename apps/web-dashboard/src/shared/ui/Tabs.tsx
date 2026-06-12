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
      <div role="tablist" className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`tabpanel-${tab.id}`}
            aria-selected={active === tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-semibold transition",
              active === tab.id ? "bg-white text-black" : "text-text-soft hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`tabpanel-${active}`} aria-labelledby={`tab-${active}`} className="mt-4">
        {tabs.find((tab) => tab.id === active)?.content}
      </div>
    </div>
  );
}
