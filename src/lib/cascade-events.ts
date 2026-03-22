// Typed event bus for cascade:* DOM events.

export interface CascadeEventMap {
  'cascade:new-file': void;
  'cascade:new-canvas': void;
  'cascade:export': void;
  'cascade:export-batch': void;
  'cascade:import': void;
  'cascade:close-vault': void;
  'cascade:about': void;
  'cascade:open-settings': void;
  'cascade:open-command-palette': void;
  'cascade:vault-changed': void;
  'cascade:variables-set': void;
  'cascade:variables-list': void;
  'cascade:variables-replace-all': void;
  'cascade:variables-replace-selection': void;
  'cascade:variables-copy-replaced': void;
  'cascade:variables-copy-line': void;
  'cascade:variables-copy-selection': void;
  'cascade:open-search-replace': void;
  'cascade:fs-change': void;
  'cascade:sidebar-view': string;
  'cascade:reveal-in-tree': { path: string };
  'cascade:filter-tag': string;
  'cascade:file-conflict': { filePath: string; externalContent: string };
  'cascade:open-image-viewer': { src: string; alt?: string };
  'cascade:open-plugin-view': { viewType: string };
  'cascade:open-file': { path: string };
  'cascade:open-search': { query?: string } | void;
  'cascade:deep-link-open': { vaultName: string; notePath: string };
  'cascade:deep-link-new': { title: string; template?: string };
  'cascade:execute-command': { commandId: string };
  'cascade:vault-opened': { vaultPath: string };
  'cascade:vault-closing': { vaultPath: string };
}

type CascadeEventName = keyof CascadeEventMap;

/** Emit a typed cascade event. */
export function emit<K extends CascadeEventName>(
  name: K,
  ...args: CascadeEventMap[K] extends void ? [] : [CascadeEventMap[K]]
): void {
  if (args.length === 0) {
    window.dispatchEvent(new Event(name));
  } else {
    window.dispatchEvent(new CustomEvent(name, { detail: args[0] }));
  }
}

/** Listen for a typed cascade event. Returns an unsubscribe function. */
export function on<K extends CascadeEventName>(
  name: K,
  handler: CascadeEventMap[K] extends void
    ? () => void
    : (detail: CascadeEventMap[K]) => void,
): () => void {
  const wrapper = (e: Event) => {
    if (e instanceof CustomEvent) {
      (handler as (detail: unknown) => void)(e.detail);
    } else {
      (handler as () => void)();
    }
  };
  window.addEventListener(name, wrapper);
  return () => window.removeEventListener(name, wrapper);
}
