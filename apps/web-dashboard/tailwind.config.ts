import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: "rgb(var(--x-bg-rgb) / <alpha-value>)",
        panel: "rgb(var(--x-surface-rgb) / <alpha-value>)",
        "panel-soft": "rgb(var(--x-surface-2-rgb) / <alpha-value>)",
        "panel-hover": "rgb(var(--x-surface-3-rgb) / <alpha-value>)",
        line: "rgb(var(--x-border-rgb) / <alpha-value>)",
        "line-soft": "rgb(var(--x-border-soft-rgb) / <alpha-value>)",
        "text-primary": "rgb(var(--x-text-rgb) / <alpha-value>)",
        "text-strong": "rgb(var(--x-text-strong-rgb) / <alpha-value>)",
        "text-muted": "rgb(var(--x-text-muted-rgb) / <alpha-value>)",
        "text-soft": "rgb(var(--x-text-soft-rgb) / <alpha-value>)",
        mint: "rgb(var(--x-blue-rgb) / <alpha-value>)",
        amber: "rgb(var(--x-yellow-rgb) / <alpha-value>)",
        rose: "rgb(var(--x-red-rgb) / <alpha-value>)",
        success: "rgb(var(--x-green-rgb) / <alpha-value>)",
        warning: "rgb(var(--x-orange-rgb) / <alpha-value>)",
        ai: "rgb(var(--x-purple-rgb) / <alpha-value>)",
        code: "rgb(var(--x-code-bg-rgb) / <alpha-value>)",
        "chart-1": "rgb(var(--x-chart-1-rgb) / <alpha-value>)",
        "chart-2": "rgb(var(--x-chart-2-rgb) / <alpha-value>)",
        "chart-3": "rgb(var(--x-chart-3-rgb) / <alpha-value>)",
        "chart-4": "rgb(var(--x-chart-4-rgb) / <alpha-value>)",
        "chart-5": "rgb(var(--x-chart-5-rgb) / <alpha-value>)"
      },
      boxShadow: {
        panel: "none",
        glow: "0 0 0 1px rgba(29, 155, 240, 0.18), 0 12px 40px rgba(0, 0, 0, 0.28)"
      },
      fontFamily: {
        sans: ["Inter", "Geist", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"Geist Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
