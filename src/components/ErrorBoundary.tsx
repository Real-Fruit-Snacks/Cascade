import React, { Component, type ReactNode } from 'react';
import i18next from 'i18next';
import { createLogger } from '../lib/logger';

const log = createLogger('ErrorBoundary');

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
    log.error(`[${this.props.name || 'unknown'}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center h-full gap-3 p-8"
          style={{ color: 'var(--ctp-subtext0)' }}
        >
          <div className="text-lg font-medium" style={{ color: 'var(--ctp-text)' }}>{i18next.t('common:somethingWentWrong')}</div>
          <div className="text-sm max-w-md text-center">{this.state.error?.message || i18next.t('common:unexpectedError')}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)' }}
          >
            {i18next.t('common:tryAgain')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
