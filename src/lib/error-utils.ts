import { useToastStore } from '../stores/toast-store';

/** Extract a human-readable message from an unknown error value. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

/** Show an error toast for a failed operation. */
export function showErrorToast(operation: string, err: unknown): void {
  useToastStore.getState().addToast(`${operation}: ${errorMessage(err)}`, 'error');
}
