import { type Extension } from '@codemirror/state';
import { yCollab } from 'y-codemirror.next';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

export function buildCollabExtension(ytext: Y.Text, awareness: Awareness): Extension {
  return yCollab(ytext, awareness);
}
