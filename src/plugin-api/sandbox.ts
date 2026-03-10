/**
 * Plugin Sandbox — runs plugin code in a sandboxed iframe with postMessage RPC.
 *
 * The iframe has `sandbox="allow-scripts"` which prevents:
 * - Same-origin access (no access to parent DOM, stores, Tauri IPC)
 * - Form submission, popups, top navigation, modals
 * - Pointer lock, orientation lock, presentation
 *
 * All plugin API calls are proxied through postMessage and handled
 * by the host, which enforces permission checks.
 */

import type { PluginPermission } from './types';
import type { FsChangeEvent } from '../types';
import { useVaultStore } from '../stores/vault-store';
import { useEditorStore } from '../stores/editor-store';
import { usePluginStore } from '../stores/plugin-store';
import { useToastStore } from '../stores/toast-store';
import { commandRegistry } from '../lib/command-registry';
import * as cmd from '../lib/tauri-commands';

// ── Message types ──

interface RpcRequest {
  type: 'rpc';
  id: string;
  method: string;
  args: unknown[];
}

interface CallbackRegistration {
  type: 'register-callback';
  callbackId: string;
  forMethod: string;
}

interface SandboxReady {
  type: 'ready';
}

interface PluginLoaded {
  type: 'loaded';
  plugin: { id: string; name: string; version: string };
}

interface SandboxError {
  type: 'error';
  error: string;
}

interface LifecycleDone {
  type: 'lifecycle-done';
  method: string;
  error?: string;
}

type SandboxMessage = RpcRequest | CallbackRegistration | SandboxReady | PluginLoaded | SandboxError | LifecycleDone;

// ── Iframe bootstrap code (runs inside the sandbox) ──

const SANDBOX_BOOTSTRAP = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body><script>
"use strict";

const pendingRpc = new Map();
const callbackRegistry = new Map();
let pluginInstance = null;
let rpcCounter = 0;

let _nonce = null;
function sendToHost(msg) {
  parent.postMessage({ ...msg, _nonce }, "*");
}

function rpc(method, args) {
  return new Promise((resolve, reject) => {
    const id = "rpc-" + (++rpcCounter);
    pendingRpc.set(id, { resolve, reject });
    sendToHost({ type: "rpc", id, method, args: args || [] });
  });
}

function registerCallback(fn, forMethod) {
  const cbId = "cb-" + (++rpcCounter);
  callbackRegistry.set(cbId, fn);
  return cbId;
}

function buildContext() {
  return {
    vault: {
      getFiles: () => rpc("vault.getFiles"),
      readFile: (path) => rpc("vault.readFile", [path]),
      writeFile: (path, content) => rpc("vault.writeFile", [path, content]),
      onFileChange: (cb) => {
        const cbId = registerCallback(cb, "vault.onFileChange");
        rpc("vault.onFileChange", [cbId]);
        return () => rpc("vault.offFileChange", [cbId]);
      },
    },
    editor: {
      getSelection: () => rpc("editor.getSelection"),
      replaceSelection: (text) => rpc("editor.replaceSelection", [text]),
      getCursor: () => rpc("editor.getCursor"),
      getActiveFile: () => rpc("editor.getActiveFile"),
      getContent: () => rpc("editor.getContent"),
      setContent: (content) => rpc("editor.setContent", [content]),
      insertAtCursor: (text) => rpc("editor.insertAtCursor", [text]),
    },
    ui: {
      addCommand: (cmd) => {
        const runCbId = registerCallback(cmd.run, "ui.addCommand");
        rpc("ui.addCommand", [{ id: cmd.id, label: cmd.label, shortcut: cmd.shortcut, runCallbackId: runCbId }]);
        return () => rpc("ui.removeCommand", [cmd.id, runCbId]);
      },
      addStatusBarItem: (item) => {
        const clickCbId = item.onClick ? registerCallback(item.onClick, "ui.addStatusBarItem") : null;
        rpc("ui.addStatusBarItem", [{ id: item.id, text: item.text, clickCallbackId: clickCbId }]);
        return () => rpc("ui.removeStatusBarItem", [item.id]);
      },
      removeStatusBarItem: (id) => rpc("ui.removeStatusBarItem", [id]),
      addSidebarPanel: (id, component) => rpc("ui.addSidebarPanel", [id]),
      showNotification: (message, type) => rpc("ui.showNotification", [message, type]),
    },
    events: {
      on: (event, cb) => {
        const cbId = registerCallback(cb, "events.on");
        rpc("events.on", [event, cbId]);
        return () => rpc("events.off", [event, cbId]);
      },
      emit: (event, data) => rpc("events.emit", [event, data]),
    },
    settings: {
      get: (key, defaultValue) => rpc("settings.get", [key, defaultValue]),
      set: (key, value) => rpc("settings.set", [key, value]),
      getAll: () => rpc("settings.getAll"),
    },
  };
}

window.addEventListener("message", async (e) => {
  if (e.source !== parent) return;
  const msg = e.data;
  if (!msg || !msg.type) return;

  if (msg.type === "init") {
    _nonce = msg._nonce || null;
    try {
      const ctx = buildContext();
      const blob = new Blob([msg.code], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      let mod;
      try {
        mod = await import(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const factory = mod.default || mod.activate;
      if (typeof factory !== "function") {
        throw new Error("Plugin has no default or activate export");
      }
      pluginInstance = await factory(ctx);
      sendToHost({
        type: "loaded",
        plugin: { id: pluginInstance.id, name: pluginInstance.name, version: pluginInstance.version },
      });
    } catch (err) {
      sendToHost({ type: "error", error: String(err) });
    }
  }

  else if (msg.type === "lifecycle") {
    try {
      if (pluginInstance && typeof pluginInstance[msg.method] === "function") {
        await pluginInstance[msg.method]();
      }
      sendToHost({ type: "lifecycle-done", method: msg.method });
    } catch (err) {
      sendToHost({ type: "lifecycle-done", method: msg.method, error: String(err) });
    }
  }

  else if (msg.type === "rpc-response") {
    const pending = pendingRpc.get(msg.id);
    if (pending) {
      pendingRpc.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error));
      else pending.resolve(msg.result);
    }
  }

  else if (msg.type === "callback") {
    const cb = callbackRegistry.get(msg.callbackId);
    if (cb) {
      try { cb(...(msg.args || [])); } catch {}
    }
  }
});

sendToHost({ type: "ready" });
<` + `/script></body></html>`;

// ── Host-side sandbox manager ──

function requirePermission(permissions: PluginPermission[], required: PluginPermission) {
  if (!permissions.includes(required)) {
    throw new Error(`Plugin lacks "${required}" permission`);
  }
}

/** Reject paths that attempt to escape the vault via traversal */
function validateVaultPath(path: string) {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error('Invalid path: traversal or absolute paths are not allowed');
  }
}

export class PluginSandbox {
  private iframe: HTMLIFrameElement;
  private permissions: PluginPermission[];
  private pluginId: string;
  private cleanups: (() => void)[] = [];
  private callbackMap = new Map<string, string>(); // callbackId → event/command mapping
  private eventCallbacks = new Map<string, (() => void)>(); // callbackId → unsubscribe fn
  private messageHandler: (e: MessageEvent) => void;
  private pendingInit: { resolve: (v: { id: string; name: string; version: string }) => void; reject: (e: Error) => void } | null = null;
  private pendingLifecycle: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private nonce: string;

  constructor(pluginId: string, permissions: PluginPermission[]) {
    if (!/^[a-zA-Z0-9_-]+$/.test(pluginId)) {
      throw new Error(`Invalid plugin ID: ${pluginId}`);
    }
    this.pluginId = pluginId;
    this.permissions = permissions;
    this.nonce = crypto.randomUUID();

    this.iframe = document.createElement('iframe');
    this.iframe.sandbox.add('allow-scripts');
    this.iframe.style.display = 'none';
    this.iframe.srcdoc = SANDBOX_BOOTSTRAP;

    this.messageHandler = (e: MessageEvent) => {
      if (e.source !== this.iframe.contentWindow) return;
      const data = e.data;
      // Validate nonce on all messages except 'ready' (sent before nonce is shared)
      if (data?.type !== 'ready' && data?._nonce !== this.nonce) return;
      this.handleMessage(data as SandboxMessage);
    };
    window.addEventListener('message', this.messageHandler);
  }

  async load(jsContent: string): Promise<{ id: string; name: string; version: string }> {
    return new Promise((resolve, reject) => {
      this.pendingInit = { resolve, reject };

      const onReady = (e: MessageEvent) => {
        if (e.source !== this.iframe.contentWindow) return;
        const msg = e.data;
        if (msg?.type === 'ready') {
          window.removeEventListener('message', onReady);
          this.iframe.contentWindow!.postMessage(
            { type: 'init', code: jsContent, pluginId: this.pluginId, permissions: this.permissions, _nonce: this.nonce },
            '*',
          );
        }
      };
      window.addEventListener('message', onReady);

      document.body.appendChild(this.iframe);

      // Timeout if plugin never loads
      setTimeout(() => {
        if (this.pendingInit) {
          this.pendingInit.reject(new Error('Plugin load timed out (10s)'));
          this.pendingInit = null;
        }
      }, 10000);
    });
  }

  async callLifecycle(method: 'onLoad' | 'onUnload'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingLifecycle = { resolve, reject };
      this.iframe.contentWindow?.postMessage({ type: 'lifecycle', method }, '*');

      setTimeout(() => {
        if (this.pendingLifecycle) {
          this.pendingLifecycle.reject(new Error(`Plugin ${method} timed out (10s)`));
          this.pendingLifecycle = null;
        }
      }, 10000);
    });
  }

  destroy() {
    for (const cleanup of this.cleanups) {
      try { cleanup(); } catch { /* best effort */ }
    }
    for (const unsub of this.eventCallbacks.values()) {
      try { unsub(); } catch { /* best effort */ }
    }
    this.cleanups = [];
    this.eventCallbacks.clear();
    this.callbackMap.clear();
    window.removeEventListener('message', this.messageHandler);
    this.iframe.remove();
  }

  // Host→sandbox messages use '*' targetOrigin because srcdoc iframes have an opaque
  // (null) origin. The sandbox is the untrusted party — host-to-sandbox auth is unnecessary
  // since the sandbox cannot access anything outside itself (sandbox="allow-scripts" only).
  private sendToSandbox(msg: unknown) {
    this.iframe.contentWindow?.postMessage(msg, '*');
  }

  invokeCallback(callbackId: string, ...args: unknown[]) {
    this.sendToSandbox({ type: 'callback', callbackId, args });
  }

  private handleMessage(msg: SandboxMessage) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'loaded':
        if (this.pendingInit) {
          this.pendingInit.resolve(msg.plugin);
          this.pendingInit = null;
        }
        break;

      case 'error':
        if (this.pendingInit) {
          this.pendingInit.reject(new Error(msg.error));
          this.pendingInit = null;
        }
        break;

      case 'lifecycle-done':
        if (this.pendingLifecycle) {
          if (msg.error) {
            this.pendingLifecycle.reject(new Error(msg.error));
          } else {
            this.pendingLifecycle.resolve();
          }
          this.pendingLifecycle = null;
        }
        break;

      case 'rpc':
        this.handleRpc(msg);
        break;
    }
  }

  private async handleRpc(msg: RpcRequest) {
    try {
      const result = await this.dispatchRpc(msg.method, msg.args);
      this.sendToSandbox({ type: 'rpc-response', id: msg.id, result });
    } catch (e) {
      this.sendToSandbox({ type: 'rpc-response', id: msg.id, error: String(e) });
    }
  }

  private async dispatchRpc(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      // ── Vault API ──
      case 'vault.getFiles': {
        requirePermission(this.permissions, 'vault.read');
        return useVaultStore.getState().flatFiles.map((path) => {
          const parts = path.replace(/\\/g, '/').split('/');
          return { name: parts[parts.length - 1], path, isDir: false, children: undefined, modified: 0 };
        });
      }
      case 'vault.readFile': {
        requirePermission(this.permissions, 'vault.read');
        const filePath = args[0] as string;
        validateVaultPath(filePath);
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) throw new Error('No vault open');
        return cmd.readFile(vaultPath, filePath);
      }
      case 'vault.writeFile': {
        requirePermission(this.permissions, 'vault.write');
        const filePath = args[0] as string;
        validateVaultPath(filePath);
        const content = args[1] as string;
        const MAX_PLUGIN_WRITE_SIZE = 5 * 1024 * 1024; // 5 MB
        if (content && content.length > MAX_PLUGIN_WRITE_SIZE) {
          throw new Error(`Content exceeds maximum allowed size (${MAX_PLUGIN_WRITE_SIZE} bytes)`);
        }
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) throw new Error('No vault open');
        await cmd.writeFile(vaultPath, filePath, content);
        return undefined;
      }
      case 'vault.onFileChange': {
        requirePermission(this.permissions, 'vault.read');
        const callbackId = args[0] as string;
        const handler = (e: Event) => {
          const detail = (e as CustomEvent<FsChangeEvent>).detail;
          this.invokeCallback(callbackId, detail);
        };
        window.addEventListener('cascade:fs-change', handler);
        const unsub = () => window.removeEventListener('cascade:fs-change', handler);
        this.eventCallbacks.set(callbackId, unsub);
        return undefined;
      }
      case 'vault.offFileChange': {
        const callbackId = args[0] as string;
        const unsub = this.eventCallbacks.get(callbackId);
        if (unsub) { unsub(); this.eventCallbacks.delete(callbackId); }
        return undefined;
      }

      // ── Editor API ──
      case 'editor.getSelection': {
        requirePermission(this.permissions, 'editor.read');
        const view = useEditorStore.getState().editorViewRef.current;
        if (!view) return '';
        const { from, to } = view.state.selection.main;
        return view.state.sliceDoc(from, to);
      }
      case 'editor.replaceSelection': {
        requirePermission(this.permissions, 'editor.write');
        const view = useEditorStore.getState().editorViewRef.current;
        if (view) view.dispatch(view.state.replaceSelection(args[0] as string));
        return undefined;
      }
      case 'editor.getCursor': {
        requirePermission(this.permissions, 'editor.read');
        const view = useEditorStore.getState().editorViewRef.current;
        if (!view) return { line: 1, col: 1 };
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        return { line: line.number, col: pos - line.from + 1 };
      }
      case 'editor.getActiveFile': {
        requirePermission(this.permissions, 'editor.read');
        return useEditorStore.getState().activeFilePath;
      }
      case 'editor.getContent': {
        requirePermission(this.permissions, 'editor.read');
        return useEditorStore.getState().content;
      }
      case 'editor.setContent': {
        requirePermission(this.permissions, 'editor.write');
        const view = useEditorStore.getState().editorViewRef.current;
        if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: args[0] as string } });
        return undefined;
      }
      case 'editor.insertAtCursor': {
        requirePermission(this.permissions, 'editor.write');
        const view = useEditorStore.getState().editorViewRef.current;
        if (view) {
          const pos = view.state.selection.main.head;
          view.dispatch({ changes: { from: pos, insert: args[0] as string } });
        }
        return undefined;
      }

      // ── UI API ──
      case 'ui.addCommand': {
        requirePermission(this.permissions, 'ui.commands');
        const cmdArg = args[0] as { id: string; label: string; shortcut?: string; runCallbackId: string };
        const unsub = commandRegistry.register({
          id: cmdArg.id,
          label: cmdArg.label,
          shortcut: cmdArg.shortcut,
          run: () => this.invokeCallback(cmdArg.runCallbackId),
        });
        this.callbackMap.set(cmdArg.runCallbackId, cmdArg.id);
        this.cleanups.push(unsub);
        return undefined;
      }
      case 'ui.removeCommand': {
        requirePermission(this.permissions, 'ui.commands');
        const commandId = `${this.pluginId}:${args[0]}`;
        commandRegistry.unregister(commandId);
        return undefined;
      }
      case 'ui.addStatusBarItem': {
        requirePermission(this.permissions, 'ui.statusbar');
        const item = args[0] as { id: string; text: string; clickCallbackId?: string | null };
        const onClick = item.clickCallbackId ? () => this.invokeCallback(item.clickCallbackId!) : undefined;
        usePluginStore.getState().addStatusBarItem(item.id, item.text, onClick);
        const unsub = () => usePluginStore.getState().removeStatusBarItem(item.id);
        this.cleanups.push(unsub);
        return undefined;
      }
      case 'ui.removeStatusBarItem': {
        requirePermission(this.permissions, 'ui.statusbar');
        usePluginStore.getState().removeStatusBarItem(args[0] as string);
        return undefined;
      }
      case 'ui.addSidebarPanel': {
        requirePermission(this.permissions, 'ui.sidebar');
        const arg = args[0];
        const id = typeof arg === 'string' ? arg : (arg as { id: string; html?: string }).id;
        const html = typeof arg === 'object' ? (arg as { html?: string }).html ?? '' : '';
        usePluginStore.getState().addSidebarPanel(id, this.pluginId, html);
        const unsub = () => usePluginStore.getState().removeSidebarPanel(id);
        this.cleanups.push(unsub);
        return undefined;
      }
      case 'ui.removeSidebarPanel': {
        requirePermission(this.permissions, 'ui.sidebar');
        usePluginStore.getState().removeSidebarPanel(args[0] as string);
        return undefined;
      }
      case 'ui.showNotification': {
        useToastStore.getState().addToast(args[0] as string, (args[1] as 'info' | 'warning' | 'error') ?? 'info');
        return undefined;
      }
      case 'ui.registerView': {
        requirePermission(this.permissions, 'ui.views');
        const { viewType, html } = args[0] as { viewType: string; html: string };
        usePluginStore.getState().registerView(viewType, this.pluginId, html);
        const unsub = () => usePluginStore.getState().unregisterView(viewType);
        this.cleanups.push(unsub);
        return undefined;
      }
      case 'ui.openView': {
        requirePermission(this.permissions, 'ui.views');
        const viewType = args[0] as string;
        const views = usePluginStore.getState().customViews;
        if (!views.has(viewType)) throw new Error(`Unknown view type: ${viewType}`);
        window.dispatchEvent(new CustomEvent('cascade:open-plugin-view', { detail: { viewType } }));
        return undefined;
      }
      case 'ui.addContextMenuItem': {
        requirePermission(this.permissions, 'ui.contextmenu');
        const item = args[0] as { id: string; label: string; context: 'file' | 'editor' | 'tab'; runCallbackId: string };
        usePluginStore.getState().addContextMenuItem(item.id, this.pluginId, item.label, item.context, item.runCallbackId, this);
        const unsub = () => usePluginStore.getState().removeContextMenuItem(item.id);
        this.cleanups.push(unsub);
        return undefined;
      }
      case 'ui.removeContextMenuItem': {
        requirePermission(this.permissions, 'ui.contextmenu');
        usePluginStore.getState().removeContextMenuItem(args[0] as string);
        return undefined;
      }
      case 'ui.addRibbonIcon': {
        requirePermission(this.permissions, 'ui.ribbon');
        const item = args[0] as { id: string; icon: string; tooltip: string; runCallbackId: string };
        usePluginStore.getState().addRibbonIcon(item.id, this.pluginId, item.icon, item.tooltip, item.runCallbackId, this);
        const unsub = () => usePluginStore.getState().removeRibbonIcon(item.id);
        this.cleanups.push(unsub);
        return undefined;
      }
      case 'ui.removeRibbonIcon': {
        requirePermission(this.permissions, 'ui.ribbon');
        usePluginStore.getState().removeRibbonIcon(args[0] as string);
        return undefined;
      }
      case 'ui.addSettingsTab': {
        requirePermission(this.permissions, 'ui.settings');
        const { id, label, html } = args[0] as { id: string; label: string; html: string };
        usePluginStore.getState().addSettingsTab(id, this.pluginId, label, html);
        const unsub = () => usePluginStore.getState().removeSettingsTab(id);
        this.cleanups.push(unsub);
        return undefined;
      }
      case 'ui.removeSettingsTab': {
        requirePermission(this.permissions, 'ui.settings');
        usePluginStore.getState().removeSettingsTab(args[0] as string);
        return undefined;
      }
      case 'templates.registerFunction': {
        requirePermission(this.permissions, 'templates');
        const { name, callbackId } = args[0] as { name: string; callbackId: string };
        usePluginStore.getState().registerTemplateFunction(name, this.pluginId, callbackId, this);
        const unsub = () => usePluginStore.getState().unregisterTemplateFunction(name);
        this.cleanups.push(unsub);
        return undefined;
      }
      case 'templates.unregisterFunction': {
        requirePermission(this.permissions, 'templates');
        usePluginStore.getState().unregisterTemplateFunction(args[0] as string);
        return undefined;
      }

      // ── Events API ──
      case 'events.on': {
        requirePermission(this.permissions, 'events');
        const [event, callbackId] = args as [string, string];
        if (!/^[a-zA-Z0-9:._-]+$/.test(event)) {
          throw new Error('Invalid event name');
        }
        const eventName = `cascade:plugin:${event}`;
        const handler = (e: Event) => {
          this.invokeCallback(callbackId, (e as CustomEvent).detail);
        };
        window.addEventListener(eventName, handler);
        const unsub = () => window.removeEventListener(eventName, handler);
        this.eventCallbacks.set(callbackId, unsub);
        return undefined;
      }
      case 'events.off': {
        const callbackId = args[0] as string;
        const unsub = this.eventCallbacks.get(callbackId);
        if (unsub) { unsub(); this.eventCallbacks.delete(callbackId); }
        return undefined;
      }
      case 'events.emit': {
        requirePermission(this.permissions, 'events');
        const eventName = args[0] as string;
        if (!/^[a-zA-Z0-9:._-]+$/.test(eventName)) {
          throw new Error('Invalid event name');
        }
        // Dispatch on plugin-specific namespace for targeted listeners
        window.dispatchEvent(new CustomEvent(`cascade:plugin:${this.pluginId}:${eventName}`, { detail: args[1] }));
        // Also dispatch on the generic namespace so cross-plugin events.on listeners receive it
        window.dispatchEvent(new CustomEvent(`cascade:plugin:${eventName}`, { detail: { pluginId: this.pluginId, data: args[1] } }));
        return undefined;
      }

      // ── Settings API ──
      case 'settings.get': {
        requirePermission(this.permissions, 'settings');
        const key = args[0] as string;
        if (typeof key !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(key)) {
          throw new Error(`Invalid settings key: ${key}`);
        }
        const settingsPath = `.cascade/plugins/${this.pluginId}/settings.json`;
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return args[1]; // default value
        try {
          const raw = await cmd.readFile(vaultPath, settingsPath);
          const data = JSON.parse(raw);
          return key in data ? data[key] : args[1];
        } catch {
          return args[1];
        }
      }
      case 'settings.set': {
        requirePermission(this.permissions, 'settings');
        const key = args[0] as string;
        if (typeof key !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(key)) {
          throw new Error(`Invalid settings key: ${key}`);
        }
        const settingsPath = `.cascade/plugins/${this.pluginId}/settings.json`;
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return undefined;
        let data: Record<string, unknown> = {};
        try {
          const raw = await cmd.readFile(vaultPath, settingsPath);
          data = JSON.parse(raw);
        } catch { /* new settings file */ }
        data[key] = args[1];
        await cmd.writeFile(vaultPath, settingsPath, JSON.stringify(data, null, 2));
        return undefined;
      }
      case 'settings.getAll': {
        requirePermission(this.permissions, 'settings');
        const settingsPath = `.cascade/plugins/${this.pluginId}/settings.json`;
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return {};
        try {
          const raw = await cmd.readFile(vaultPath, settingsPath);
          return JSON.parse(raw);
        } catch {
          return {};
        }
      }

      default:
        throw new Error(`Unknown RPC method: ${method}`);
    }
  }
}
