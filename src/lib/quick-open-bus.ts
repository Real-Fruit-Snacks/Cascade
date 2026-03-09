type LinkCallback = (name: string) => void;
type Listener = (callback: LinkCallback) => void;

const listeners = new Set<Listener>();

export const quickOpenBus = {
  /** Called from CM6 to request the link picker modal */
  requestLinkPicker(callback: LinkCallback) {
    for (const fn of listeners) fn(callback);
  },

  /** Called from AppShell to listen for link picker requests */
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
