import type { EditorView } from '@codemirror/view';

export const FULL_DOC_THRESHOLD = 200_000;

/**
 * Tracks the range that has been decorated.
 *
 * For typical notes (< 200K chars), we decorate the FULL document on open
 * and on content changes, so viewport scrolling never triggers rebuilds.
 * This gives buttery-smooth scrolling.
 *
 * For very large files (> 200K chars), we fall back to viewport + buffer
 * to avoid slow initial decoration.
 */

const VIEWPORT_BUFFER = 10_000; // ~400 lines for large file fallback

/**
 * Returns the ranges to iterate for building decorations.
 * For small files, returns the full document. For large files, returns visible ranges.
 */
export function getDecorationRanges(view: EditorView): readonly { from: number; to: number }[] {
  if (view.state.doc.length <= FULL_DOC_THRESHOLD) {
    return [{ from: 0, to: view.state.doc.length }];
  }
  return view.visibleRanges;
}

export class ViewportBuffer {
  private decoratedFrom = 0;
  private decoratedTo = 0;

  /** Check if a decoration rebuild is needed for the current viewport. */
  needsRebuild(view: EditorView): boolean {
    for (const { from, to } of view.visibleRanges) {
      if (from < this.decoratedFrom || to > this.decoratedTo) {
        return true;
      }
    }
    return false;
  }

  /** Record the decorated range after a rebuild. */
  update(view: EditorView): void {
    const docLen = view.state.doc.length;
    if (docLen <= FULL_DOC_THRESHOLD) {
      // Small/medium file — cover everything, no rebuilds on scroll
      this.decoratedFrom = 0;
      this.decoratedTo = docLen;
    } else {
      // Large file — viewport + generous buffer
      let min = Infinity;
      let max = 0;
      for (const { from, to } of view.visibleRanges) {
        if (from < min) min = from;
        if (to > max) max = to;
      }
      this.decoratedFrom = Math.max(0, min - VIEWPORT_BUFFER);
      this.decoratedTo = Math.min(docLen, max + VIEWPORT_BUFFER);
    }
  }

  /** Reset on doc change (content shifted, buffer is invalid). */
  reset(): void {
    this.decoratedFrom = 0;
    this.decoratedTo = 0;
  }
}
