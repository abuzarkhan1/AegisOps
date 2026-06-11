import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "../shared/ui/ErrorState";

type ErrorBoundaryState = {
  error?: Error;
};

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          detail={import.meta.env.DEV ? this.state.error.message : "The dashboard could not render this view."}
          onRetry={() => this.setState({ error: undefined })}
          onBack={() => {
            window.history.pushState(null, "", "/");
            window.location.reload();
          }}
        />
      );
    }

    return this.props.children;
  }
}
