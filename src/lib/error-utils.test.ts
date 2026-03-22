import { describe, it, expect } from 'vitest';
import { errorMessage } from './error-utils';

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
