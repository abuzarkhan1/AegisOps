export const themeTokens = {
  name: "Aegis X Command",
  colors: {
    bg: "var(--x-bg)",
    surface: "var(--x-surface)",
    surface2: "var(--x-surface-2)",
    border: "var(--x-border)",
    text: "var(--x-text)",
    muted: "var(--x-text-muted)",
    primary: "var(--x-blue)",
    success: "var(--x-green)",
    warning: "var(--x-orange)",
    critical: "var(--x-red)",
    ai: "var(--x-purple)"
  },
  staleTimes: {
    overview: 30_000,
    connectionStatus: 10_000,
    logs: 15_000,
    metrics: 30_000,
    catalog: 60_000,
    settings: 300_000
  }
} as const;
