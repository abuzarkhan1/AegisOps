import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react/jsx-runtime"],
          router: ["react-router-dom"],
          query: ["@tanstack/react-query"],
          icons: ["lucide-react"]
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  }
});
