import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollabProvider, ProviderState } from './collab-provider';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  binaryType: string = 'arraybuffer';
  url: string;

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  sentMessages: (string | ArrayBuffer | Uint8Array)[] = [];

  constructor(url: string) {
    this.url = url;
  }

  send(data: string | ArrayBuffer | Uint8Array): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  simulateMessage(data: string | ArrayBuffer): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }
}

let mockWs: MockWebSocket | null = null;

vi.stubGlobal('WebSocket', class extends MockWebSocket {
  constructor(url: string) {
    super(url);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    mockWs = this;
  }
});

describe('CollabProvider', () => {
  let provider: CollabProvider;

  beforeEach(() => {
    mockWs = null;
    provider = new CollabProvider('ws://localhost:9999', 'secret');
  });

  afterEach(() => {
    provider.destroy();
    vi.clearAllTimers();
  });

  it('starts in Disconnected state', () => {
    expect(provider.state).toBe(ProviderState.Disconnected);
  });

  it('sends password on WebSocket open', () => {
    provider.connect();
    expect(mockWs).not.toBeNull();
    mockWs!.simulateOpen();
    expect(provider.state).toBe(ProviderState.Authenticating);
    expect(mockWs!.sentMessages[0]).toBe('secret');
  });

  it('transitions to Connected on AUTH_OK', () => {
    provider.connect();
    mockWs!.simulateOpen();
    mockWs!.simulateMessage('AUTH_OK');
    expect(provider.state).toBe(ProviderState.Connected);
  });

  it('transitions to AuthFailed on AUTH_FAILED', () => {
    provider.connect();
    mockWs!.simulateOpen();
    mockWs!.simulateMessage('AUTH_FAILED');
    expect(provider.state).toBe(ProviderState.AuthFailed);
  });

  it('fires onStateChange on each transition', () => {
    const states: ProviderState[] = [];
    provider.onStateChange = (s) => states.push(s);
    provider.connect();
    mockWs!.simulateOpen();
    mockWs!.simulateMessage('AUTH_OK');
    expect(states).toEqual([
      ProviderState.Connecting,
      ProviderState.Authenticating,
      ProviderState.Connected,
    ]);
  });

  it('cleans up on disconnect', () => {
    provider.connect();
    mockWs!.simulateOpen();
    mockWs!.simulateMessage('AUTH_OK');
    provider.disconnect();
    expect(provider.state).toBe(ProviderState.Disconnected);
  });

  it('does not reconnect after AUTH_FAILED', () => {
    vi.useFakeTimers();
    provider.connect();
    mockWs!.simulateOpen();
    mockWs!.simulateMessage('AUTH_FAILED');
    const wsAfterFail = mockWs;
    vi.advanceTimersByTime(5000);
    // Should be the same (no new connection)
    expect(mockWs).toBe(wsAfterFail);
    vi.useRealTimers();
  });
});
