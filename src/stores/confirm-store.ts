import { create } from 'zustand';

export interface ConfirmRequest {
  title: string;
  message: string;
  kind?: 'info' | 'warning';
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  resolve: ((confirmed: boolean) => void) | null;
  show: (request: ConfirmRequest) => Promise<boolean>;
  respond: (confirmed: boolean) => void;
  dismiss: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  resolve: null,

  show: (request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      const { resolve: prev } = get();
      prev?.(false);
      set({ request, resolve });
    });
  },

  respond: (confirmed: boolean) => {
    const { resolve } = get();
    resolve?.(confirmed);
    set({ request: null, resolve: null });
  },

  dismiss: () => {
    get().respond(false);
  },
}));

/** Imperative helper — works from non-React code (stores, CodeMirror extensions, etc.) */
export function showConfirm(request: ConfirmRequest): Promise<boolean> {
  return useConfirmStore.getState().show(request);
}
