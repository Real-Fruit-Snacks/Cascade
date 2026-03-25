import * as Y from 'yjs';
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { encodeStateAsUpdate, applyUpdate, encodeStateVector } from 'yjs';
import { normalizePath, isLifecycleMessage, decodeLifecycleEvent, encodeLifecycleEvent, type LifecycleEvent } from './collab-messages';

export enum ProviderState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Authenticating = 'authenticating',
  Connected = 'connected',
  AuthFailed = 'auth_failed',
}

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

const SYNC_STEP1 = 0;
const SYNC_STEP2 = 1;
const SYNC_UPDATE = 2;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export class CollabProvider {
  state: ProviderState = ProviderState.Disconnected;
  onStateChange?: (state: ProviderState) => void;
  onLifecycleEvent?: (event: LifecycleEvent) => void;
  awareness: Awareness;

  private url: string;
  private password: string;
  private ws: WebSocket | null = null;
  private docs: Map<string, Y.Doc> = new Map();
  private shouldReconnect = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, password: string) {
    this.url = url;
    this.password = password;
    const sharedDoc = new Y.Doc();
    this.awareness = new Awareness(sharedDoc);

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changedClients = [...added, ...updated, ...removed];
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.state === ProviderState.Connected) {
        const update = encodeAwarenessUpdate(this.awareness, changedClients);
        const msg = new Uint8Array(1 + update.byteLength);
        msg[0] = MSG_AWARENESS;
        msg.set(update, 1);
        this.ws.send(msg);
      }
    });
  }

  connect(): void {
    this.shouldReconnect = true;
    this._openSocket();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._closeSocket();
    this._setState(ProviderState.Disconnected);
  }

  setLocalState(fields: Record<string, unknown>): void {
    const current = this.awareness.getLocalState() ?? {};
    this.awareness.setLocalState({ ...current, ...fields });
  }

  registerDoc(filePath: string, doc: Y.Doc): void {
    const key = normalizePath(filePath);
    this.docs.set(key, doc);

    doc.on('update', (update: Uint8Array) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.state === ProviderState.Connected) {
        this._sendSyncUpdate(key, update);
      }
    });

    if (this.state === ProviderState.Connected) {
      this._sendSyncStep1(key, doc);
    }
  }

  unregisterDoc(filePath: string): void {
    const key = normalizePath(filePath);
    this.docs.delete(key);
  }

  getDoc(filePath: string): Y.Doc | undefined {
    return this.docs.get(normalizePath(filePath));
  }

  rekeyDoc(oldPath: string, newPath: string): void {
    const oldKey = normalizePath(oldPath);
    const newKey = normalizePath(newPath);
    const doc = this.docs.get(oldKey);
    if (doc) {
      this.docs.delete(oldKey);
      this.docs.set(newKey, doc);
    }
  }

  sendLifecycleEvent(event: LifecycleEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.state === ProviderState.Connected) {
      this.ws.send(encodeLifecycleEvent(event));
    }
  }

  destroy(): void {
    this.disconnect();
    removeAwarenessStates(this.awareness, [this.awareness.clientID], 'destroy');
    this.awareness.destroy();
    this.docs.clear();
  }

  private _setState(state: ProviderState): void {
    this.state = state;
    this.onStateChange?.(state);
  }

  private _openSocket(): void {
    this._setState(ProviderState.Connecting);
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this._setState(ProviderState.Authenticating);
      ws.send(this.password);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this._handleTextMessage(event.data);
      } else {
        this._handleBinaryMessage(new Uint8Array(event.data as ArrayBuffer));
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.state !== ProviderState.AuthFailed) {
        this._setState(ProviderState.Disconnected);
      }
      if (this.shouldReconnect && this.state !== ProviderState.AuthFailed) {
        this._scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private _closeSocket(): void {
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.onopen = null;
      ws.close();
    }
  }

  private _scheduleReconnect(): void {
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt), RECONNECT_MAX_MS);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this._openSocket();
      }
    }, delay);
  }

  private _handleTextMessage(data: string): void {
    if (data === 'AUTH_OK') {
      this.reconnectAttempt = 0;
      this._setState(ProviderState.Connected);
      // Send sync step 1 for all registered docs + broadcast awareness
      for (const [path, doc] of this.docs) {
        this._sendSyncStep1(path, doc);
      }
      const allClients = Array.from(this.awareness.getStates().keys());
      if (allClients.length > 0) {
        const update = encodeAwarenessUpdate(this.awareness, allClients);
        const msg = new Uint8Array(1 + update.byteLength);
        msg[0] = MSG_AWARENESS;
        msg.set(update, 1);
        this.ws?.send(msg);
      }
    } else if (data === 'AUTH_FAILED') {
      this._setState(ProviderState.AuthFailed);
      this.shouldReconnect = false;
      this._closeSocket();
    } else if (isLifecycleMessage(data)) {
      try {
        const event = decodeLifecycleEvent(data);
        this.onLifecycleEvent?.(event);
      } catch (e) {
        console.warn('[collab] Malformed lifecycle message:', e);
      }
    }
  }

  private _handleBinaryMessage(data: Uint8Array): void {
    if (data.length === 0) return;
    const msgType = data[0];

    if (msgType === MSG_SYNC) {
      // [MSG_SYNC] [pathLen 2B BE] [path UTF-8] [syncType 1B] [data...]
      if (data.length < 3) return;
      const pathLen = (data[1] << 8) | data[2];
      if (data.length < 3 + pathLen + 1) return;
      const pathBytes = data.slice(3, 3 + pathLen);
      const path = new TextDecoder().decode(pathBytes);
      const syncType = data[3 + pathLen];
      const payload = data.slice(3 + pathLen + 1);

      const doc = this.docs.get(path);
      if (!doc) return;

      if (syncType === SYNC_STEP1) {
        // Remote sent us their state vector — respond with SYNC_STEP2 only
        const remoteStateVector = payload;
        const update = encodeStateAsUpdate(doc, remoteStateVector);
        this._sendSyncStep2(path, update);
      } else if (syncType === SYNC_STEP2 || syncType === SYNC_UPDATE) {
        // Apply the update
        try {
          applyUpdate(doc, payload);
        } catch (e) {
          console.warn('[collab] Malformed sync update:', e);
        }
      }
    } else if (msgType === MSG_AWARENESS) {
      const update = data.slice(1);
      try {
        applyAwarenessUpdate(this.awareness, update, this);
      } catch (e) {
        console.warn('[collab] Malformed awareness update:', e);
      }
    }
  }

  private _buildSyncHeader(path: string, syncType: number): Uint8Array {
    const pathBytes = new TextEncoder().encode(path);
    if (pathBytes.byteLength > 65535) {
      throw new Error(`Path too long for sync protocol: ${pathBytes.byteLength} bytes`);
    }
    const header = new Uint8Array(1 + 2 + pathBytes.byteLength + 1);
    header[0] = MSG_SYNC;
    header[1] = (pathBytes.byteLength >> 8) & 0xff;
    header[2] = pathBytes.byteLength & 0xff;
    header.set(pathBytes, 3);
    header[3 + pathBytes.byteLength] = syncType;
    return header;
  }

  private _sendSyncStep1(path: string, doc: Y.Doc): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const stateVector = encodeStateVector(doc);
    const header = this._buildSyncHeader(path, SYNC_STEP1);
    const msg = new Uint8Array(header.byteLength + stateVector.byteLength);
    msg.set(header, 0);
    msg.set(stateVector, header.byteLength);
    this.ws.send(msg);
  }

  private _sendSyncStep2(path: string, update: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const header = this._buildSyncHeader(path, SYNC_STEP2);
    const msg = new Uint8Array(header.byteLength + update.byteLength);
    msg.set(header, 0);
    msg.set(update, header.byteLength);
    this.ws.send(msg);
  }

  private _sendSyncUpdate(path: string, update: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const header = this._buildSyncHeader(path, SYNC_UPDATE);
    const msg = new Uint8Array(header.byteLength + update.byteLength);
    msg.set(header, 0);
    msg.set(update, header.byteLength);
    this.ws.send(msg);
  }
}
