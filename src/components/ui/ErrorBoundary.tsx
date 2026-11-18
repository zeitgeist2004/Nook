import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { getTranslations } from '../../i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  scope?: 'app' | 'editor' | 'modal';
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const rawMsg = error instanceof Error ? error.message : String(error || '');
    return {
      hasError: true,
      errorMessage: rawMsg.slice(0, 180) || null,
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    // Log diagnostic metadata locally without exposing private note contents
    console.error(`[Nook:${this.props.scope || 'ui'}] Render boundary caught error:`, {
      message: error instanceof Error ? error.message : String(error),
      componentStack: errorInfo?.componentStack?.slice(0, 400),
    });
  }

  handleRecover = (): void => {
    this.setState({ hasError: false, errorMessage: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { ux } = getTranslations();
    const isFull = this.props.scope === 'app';

    return (
      <div
        role="alert"
        style={{
          width: isFull ? '100vw' : '100%',
          height: isFull ? 'var(--nook-viewport-height, 100dvh)' : '100%',
          minHeight: isFull ? '100dvh' : '180px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: 'var(--bg-main, #0D0E11)',
          color: 'var(--text-primary, #ECEAE5)',
          textAlign: 'center',
          gap: '12px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-elevated, #18191E)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary, #A1A6B3)',
          }}
        >
          <AlertTriangle size={18} />
        </div>
        <div style={{ maxWidth: '340px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
            {ux.errorBoundaryTitle}
          </div>
          <div style={{ fontSize: '12.5px', lineHeight: 1.45, color: 'var(--text-secondary, #A1A6B3)' }}>
            {ux.errorBoundaryDesc}
          </div>
        </div>
        <button
          type="button"
          onClick={this.handleRecover}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12.5px',
          }}
        >
          <RefreshCw size={13} />
          <span>{ux.errorBoundaryRetry}</span>
        </button>
      </div>
    );
  }
}
