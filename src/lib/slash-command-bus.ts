export interface SlashCommandRequest {
  /** Pixel position for the menu (relative to editor container) */
  x: number;
  y: number;
  /** Document position of the `/` character */
  from: number;
  /** Current query text after `/` */
  query: string;
}

type OpenListener = (request: SlashCommandRequest) => void;
type CloseListener = () => void;
type UpdateListener = (query: string, from: number) => void;

const openListeners = new Set<OpenListener>();
const closeListeners = new Set<CloseListener>();
const updateListeners = new Set<UpdateListener>();

export const slashCommandBus = {
  open(request: SlashCommandRequest) {
    for (const fn of openListeners) fn(request);
  },
  close() {
    for (const fn of closeListeners) fn();
  },
  updateQuery(query: string, from: number) {
    for (const fn of updateListeners) fn(query, from);
  },
  onOpen(listener: OpenListener) {
    openListeners.add(listener);
    return () => { openListeners.delete(listener); };
  },
  onClose(listener: CloseListener) {
    closeListeners.add(listener);
    return () => { closeListeners.delete(listener); };
  },
  onUpdate(listener: UpdateListener) {
    updateListeners.add(listener);
    return () => { updateListeners.delete(listener); };
  },
};
