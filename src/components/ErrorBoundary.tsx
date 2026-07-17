"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error(
      { module: "ErrorBoundary", err: error, componentStack: info.componentStack },
      "React error boundary caught error"
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rounded-2xl border border-[#a33a3a]/30 bg-[#a33a3a]/5 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#a33a3a]" />
            <p className="text-sm text-[#a33a3a]">Something went wrong</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="text-xs text-[#8b4513] hover:underline mt-2"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
