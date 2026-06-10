import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#0b1014",
        panel: "#11181e",
        line: "#26323a",
        mint: "#35d0a5",
        amber: "#f7c948",
        rose: "#fb7185"
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
} satisfies Config;

