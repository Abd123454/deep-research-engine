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
        <div className="rounded-2xl border border-[#c44848]/30 bg-[#c44848]/5 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#c44848]" />
            <p className="text-sm text-[#c44848]">Something went wrong</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="text-xs text-[#c96442] hover:underline mt-2"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
