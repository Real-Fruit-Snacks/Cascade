import { create } from 'zustand';

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastAction {
  label: string;
  action: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  toastAction?: ToastAction;
  dismissing?: boolean;
}

interface ToastState {
  toasts: Toast[];
}

interface ToastActions {
  addToast: (message: string, type: ToastType, duration?: number, toastAction?: ToastAction) => void;
  removeToast: (id: string) => void;
  dismissToast: (id: string) => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
  clearAll: () => void;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  info: 5000,
  success: 5000,
  error: 10000,
  warning: 10000,
};

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Remaining ms when paused */
const pausedRemaining = new Map<string, number>();
/** Timestamp when timer was last started/resumed */
const timerStartedAt = new Map<string, number>();

const DISMISS_ANIMATION_MS = 200;

function startTimer(id: string, ms: number) {
  timerStartedAt.set(id, Date.now());
  const timer = setTimeout(() => {
    timers.delete(id);
    timerStartedAt.delete(id);
    useToastStore.getState().dismissToast(id);
  }, ms);
  timers.set(id, timer);
}

export const useToastStore = create<ToastState & ToastActions>((set) => ({
  toasts: [],

  addToast: (message: string, type: ToastType, duration?: number, toastAction?: ToastAction) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const resolvedDuration = duration ?? DEFAULT_DURATION[type];

    set((s) => {
      const toasts = [...s.toasts, { id, message, type, duration: resolvedDuration, toastAction }].slice(-5);
      return { toasts };
    });

    startTimer(id, resolvedDuration);
  },

  dismissToast: (id: string) => {
    // Mark as dismissing, then remove after animation
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, dismissing: true } : t)),
    }));
    setTimeout(() => {
      useToastStore.getState().removeToast(id);
    }, DISMISS_ANIMATION_MS);
  },

  removeToast: (id: string) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    timerStartedAt.delete(id);
    pausedRemaining.delete(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  pauseToast: (id: string) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
      const started = timerStartedAt.get(id) ?? Date.now();
      const elapsed = Date.now() - started;
      const toast = useToastStore.getState().toasts.find((t) => t.id === id);
      const total = toast?.duration ?? DEFAULT_DURATION[toast?.type ?? 'info'];
      pausedRemaining.set(id, Math.max(total - elapsed, 500));
    }
  },

  resumeToast: (id: string) => {
    const remaining = pausedRemaining.get(id);
    if (remaining != null) {
      pausedRemaining.delete(id);
      startTimer(id, remaining);
    }
  },

  clearAll: () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    timerStartedAt.clear();
    pausedRemaining.clear();
    set({ toasts: [] });
  },
}));
