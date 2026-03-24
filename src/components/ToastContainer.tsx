import { useToastStore } from '../stores/toast-store';
import type { Toast, ToastType } from '../stores/toast-store';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

const ICONS: Record<ToastType, React.ReactNode> = {
  error: <AlertCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
  success: <CheckCircle size={16} />,
};

const TOAST_COLORS: Record<ToastType, string> = {
  error: 'var(--ctp-red)',
  warning: 'var(--ctp-yellow)',
  info: 'var(--ctp-blue)',
  success: 'var(--ctp-green)',
};

function ToastItem({ toast, index }: { toast: Toast; index: number }) {
  const dismissToast = useToastStore((s) => s.dismissToast);
  const removeToast = useToastStore((s) => s.removeToast);
  const pauseToast = useToastStore((s) => s.pauseToast);
  const resumeToast = useToastStore((s) => s.resumeToast);

  return (
    <div
      onMouseEnter={() => pauseToast(toast.id)}
      onMouseLeave={() => resumeToast(toast.id)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        backgroundColor: 'var(--ctp-surface0)',
        border: '1px solid var(--ctp-surface1)',
        borderLeft: `3px solid ${TOAST_COLORS[toast.type]}`,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        minWidth: 260,
        maxWidth: 380,
        animation: toast.dismissing
          ? 'toast-slide-out 0.2s ease-in forwards'
          : `toast-slide-in 0.2s ease-out ${index * 40}ms both`,
      }}
    >
      <span style={{ color: TOAST_COLORS[toast.type], flexShrink: 0, marginTop: 1 }}>
        {ICONS[toast.type]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: '0.8125rem',
            color: 'var(--ctp-text)',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {toast.message}
        </span>
        {toast.toastAction && (
          <button
            onClick={() => {
              toast.toastAction!.action();
              removeToast(toast.id);
            }}
            style={{
              display: 'inline-block',
              marginLeft: 8,
              padding: '2px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--ctp-base)',
              backgroundColor: TOAST_COLORS[toast.type],
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {toast.toastAction.label}
          </button>
        )}
      </div>
      <button
        onClick={() => dismissToast(toast.id)}
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ctp-overlay1)',
          padding: 0,
          marginTop: 1,
          display: 'flex',
          alignItems: 'center',
        }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toast-slide-out {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(20px); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 36,
          right: 16,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        {toasts.map((toast, index) => (
          <ToastItem key={toast.id} toast={toast} index={index} />
        ))}
      </div>
    </>
  );
}
