import type { ReactNode } from "react";
import { AuthProvider } from "./auth";
import { ErrorBoundary } from "./ErrorBoundary";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>{children}</AuthProvider>
    </ErrorBoundary>
  );
}
