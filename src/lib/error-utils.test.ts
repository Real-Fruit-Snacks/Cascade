import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorMessage, showErrorToast } from './error-utils';

// ── showErrorToast mock ────────────────────────────────────────

const mockAddToast = vi.fn();

vi.mock('../stores/toast-store', () => ({
  useToastStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
}));

describe('errorMessage', () => {
  it('returns .message from an Error instance', () => {
    const err = new Error('something went wrong');
    expect(errorMessage(err)).toBe('something went wrong');
  });

  it('returns the string itself when given a string', () => {
    expect(errorMessage('plain string error')).toBe('plain string error');
  });

  it('returns string representation of a number', () => {
    expect(errorMessage(42)).toBe('42');
  });

  it('returns "null" for null', () => {
    expect(errorMessage(null)).toBe('null');
  });

  it('returns "undefined" for undefined', () => {
    expect(errorMessage(undefined)).toBe('undefined');
  });

  it('returns string representation of an object', () => {
    expect(errorMessage({ code: 404 })).toBe('[object Object]');
  });
});

describe('showErrorToast', () => {
  beforeEach(() => {
    mockAddToast.mockClear();
  });

  it('calls addToast with type "error"', () => {
    showErrorToast('Save file', new Error('disk full'));
    expect(mockAddToast).toHaveBeenCalledOnce();
    const [, type] = mockAddToast.mock.calls[0];
    expect(type).toBe('error');
  });

  it('prefixes the message with the operation name', () => {
    showErrorToast('Load vault', new Error('not found'));
    const [message] = mockAddToast.mock.calls[0];
    expect(message).toMatch(/^Load vault:/);
  });

  it('includes the error message in the toast message', () => {
    showErrorToast('Delete file', new Error('permission denied'));
    const [message] = mockAddToast.mock.calls[0];
    expect(message).toBe('Delete file: permission denied');
  });

  it('formats a string error correctly', () => {
    showErrorToast('Export', 'something went wrong');
    const [message] = mockAddToast.mock.calls[0];
    expect(message).toBe('Export: something went wrong');
  });

  it('formats an unknown error value via String()', () => {
    showErrorToast('Parse', 42);
    const [message] = mockAddToast.mock.calls[0];
    expect(message).toBe('Parse: 42');
  });
});
