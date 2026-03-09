import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name || 'unknown'}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8" style={{ color: 'var(--ctp-subtext0)' }}>
          <div className="text-lg font-medium" style={{ color: 'var(--ctp-text)' }}>Something went wrong</div>
          <div className="text-sm max-w-md text-center">{this.state.error?.message || 'An unexpected error occurred'}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)' }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
