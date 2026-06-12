import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "vite.config.js", "vite.config.d.ts", "*.tsbuildinfo"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        AbortController: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        HTMLElement: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        RequestInit: "readonly",
        Response: "readonly",
        setTimeout: "readonly",
        URLSearchParams: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  }
);
