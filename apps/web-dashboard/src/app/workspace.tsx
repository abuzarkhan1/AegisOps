import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type WorkspaceEnvironment = "production" | "staging" | "development";
export type WorkspaceTimeRange = "15m" | "1h" | "24h" | "7d";

type WorkspaceContextValue = {
  environment: WorkspaceEnvironment;
  setEnvironment: (environment: WorkspaceEnvironment) => void;
  timeRange: WorkspaceTimeRange;
  setTimeRange: (timeRange: WorkspaceTimeRange) => void;
  timeRangeHours: number;
  fromIso: string;
};

const timeRangeHours: Record<WorkspaceTimeRange, number> = {
  "15m": 0.25,
  "1h": 1,
  "24h": 24,
  "7d": 24 * 7
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironment] = useState<WorkspaceEnvironment>(() => {
    const stored = window.localStorage.getItem("aegisops:environment");
    return stored === "production" || stored === "staging" || stored === "development" ? stored : "production";
  });
  const [timeRange, setTimeRange] = useState<WorkspaceTimeRange>(() => {
    const stored = window.localStorage.getItem("aegisops:time-range");
    return stored === "15m" || stored === "1h" || stored === "24h" || stored === "7d" ? stored : "24h";
  });

  const value = useMemo<WorkspaceContextValue>(() => {
    const hours = timeRangeHours[timeRange];
    return {
      environment,
      setEnvironment: (next) => {
        window.localStorage.setItem("aegisops:environment", next);
        setEnvironment(next);
      },
      timeRange,
      setTimeRange: (next) => {
        window.localStorage.setItem("aegisops:time-range", next);
        setTimeRange(next);
      },
      timeRangeHours: hours,
      fromIso: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    };
  }, [environment, timeRange]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return context;
}
