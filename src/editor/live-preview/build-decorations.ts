import {
  Decoration,
  DecorationSet,
  EditorView,
} from '@codemirror/view';
import { syntaxTree, foldedRanges } from '@codemirror/language';
import type { EditorState, Range } from '@codemirror/state';
import { useVaultStore } from '../../stores/vault-store';
import { useSettingsStore } from '../../stores/settings-store';
import { resolveWikiLink, parseWikiTarget } from '../../lib/wiki-link-resolver';
import { PropertiesWidget } from '../properties-widget';
import {
  isImagePath,
  resolveVaultFileSrc,
  resolveImageSrc,
  parseFrontmatter,
  parseCallout,
  CALLOUT_ICONS,
  cursorOnLines,
  parseTableRow,
  parseAlignments,
} from './helpers';
import {
  HrWidget,
  CheckboxWidget,
  TableWidget,
  ImageWidget,
  CopyButtonWidget,
  CodeLineNumberWidget,
  CalloutHeaderWidget,
  TransclusionWidget,
} from './widgets';

export function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const deco: Range<Decoration>[] = [];
  const tree = syntaxTree(state);
  const lpSettings = useSettingsStore.getState();

  // ── Frontmatter source styling (widget replacement handled by frontmatterField) ──
  const fm = parseFrontmatter(state);
  if (fm) {
    const fmActive = cursorOnLines(state, 0, fm.endPos);
    if (fmActive || !lpSettings.enableProperties) {
      // Style frontmatter lines when editing
      for (let i = 1; i <= fm.endLine; i++) {
        deco.push(Decoration.line({ class: 'cm-frontmatter-source' }).range(state.doc.line(i).from));
      }
    }
  }

  // Track frontmatter end position so tree iteration can skip those nodes
  const fmEndPos = fm ? fm.endPos : -1;

  // ── Embed transclusions ![[target]] (text-level scan) ──
  const EMBED_RE = /!\[\[([^\]]+)\]\]/g;
  const flatFiles = useVaultStore.getState().flatFiles;

  for (const { from, to } of view.visibleRanges) {
    const text = state.sliceDoc(from, to);
    EMBED_RE.lastIndex = 0;
    let embedMatch: RegExpExecArray | null;
    while ((embedMatch = EMBED_RE.exec(text)) !== null) {
      const matchFrom = from + embedMatch.index;
      const matchTo = matchFrom + embedMatch[0].length;

      // Skip if inside frontmatter
      if (fmEndPos >= 0 && matchFrom <= fmEndPos) continue;

      const target = embedMatch[1];
      const active = cursorOnLines(state, matchFrom, matchTo);

      if (!active) {
        const { heading: embedHeading, blockId: embedBlockId } = parseWikiTarget(target);
        const resolved = resolveWikiLink(target, flatFiles);
        if (resolved && isImagePath(resolved)) {
          const src = resolveVaultFileSrc(resolved);
          if (src) {
            deco.push(
              Decoration.replace({
                widget: new ImageWidget(src, target, target, -1, -1),
              }).range(matchFrom, matchTo)
            );
            continue;
          }
        }
        if (resolved) {
          deco.push(
            Decoration.replace({
              widget: new TransclusionWidget(resolved, target, embedHeading, embedBlockId),
            }).range(matchFrom, matchTo)
          );
        } else {
          // Unresolved embed — style as broken
          deco.push(Decoration.mark({ class: 'cm-embed-broken' }).range(matchFrom, matchTo));
        }
      } else {
        // Cursor on embed line — show source styled
        deco.push(Decoration.mark({ class: 'cm-embed-source' }).range(matchFrom, matchTo));
      }
    }
  }

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(nodeRef) {
        const { from: nFrom, to: nTo, name } = nodeRef;

        // Skip any nodes that overlap with frontmatter (parser misinterprets it)
        if (fmEndPos >= 0 && nFrom <= fmEndPos && name !== 'Document') return false;

        const active = cursorOnLines(state, nFrom, nTo);

        // ── Headers ──
        if (name.startsWith('ATXHeading')) {
          if (!lpSettings.livePreviewHeadings) return;
          const level = parseInt(name.replace('ATXHeading', ''), 10);
          if (level >= 1 && level <= 6) {
            const line = state.doc.lineAt(nFrom);
            deco.push(
              Decoration.line({ class: `cm-heading cm-heading-${level}` }).range(line.from)
            );
            if (!active) {
              const mark = nodeRef.node.getChild('HeaderMark');
              if (mark) {
                let end = mark.to;
                // Also hide the space after the #'s
                if (end < nTo && state.sliceDoc(end, end + 1) === ' ') end++;
                deco.push(Decoration.replace({}).range(mark.from, end));
              }
            }
          }
          return;
        }

        // ── Bold ──
        if (name === 'StrongEmphasis' && lpSettings.livePreviewBold) {
          deco.push(Decoration.mark({ class: 'cm-live-bold' }).range(nFrom, nTo));
          if (!active) {
            for (const m of nodeRef.node.getChildren('EmphasisMark')) {
              deco.push(Decoration.replace({}).range(m.from, m.to));
            }
          }
          return;
        }

        // ── Italic ──
        if (name === 'Emphasis' && lpSettings.livePreviewItalic) {
          deco.push(Decoration.mark({ class: 'cm-live-italic' }).range(nFrom, nTo));
          if (!active) {
            for (const m of nodeRef.node.getChildren('EmphasisMark')) {
              deco.push(Decoration.replace({}).range(m.from, m.to));
            }
          }
          return;
        }

        // ── Inline code ──
        if (name === 'InlineCode') {
          deco.push(Decoration.mark({ class: 'cm-live-code' }).range(nFrom, nTo));
          if (!active) {
            for (const m of nodeRef.node.getChildren('CodeMark')) {
              deco.push(Decoration.replace({}).range(m.from, m.to));
            }
          }
          return;
        }

        // ── Strikethrough ~~text~~ ──
        if (name === 'Strikethrough') {
          deco.push(Decoration.mark({ class: 'cm-live-strikethrough' }).range(nFrom, nTo));
          if (!active) {
            for (const m of nodeRef.node.getChildren('StrikethroughMark')) {
              deco.push(Decoration.replace({}).range(m.from, m.to));
            }
          }
          return;
        }

        // ── Links [text](url) ──
        if (name === 'Link' && lpSettings.livePreviewLinks) {
          deco.push(Decoration.mark({ class: 'cm-live-link' }).range(nFrom, nTo));
          if (!active) {
            const marks = nodeRef.node.getChildren('LinkMark');
            if (marks.length >= 2) {
              // Hide opening [
              deco.push(Decoration.replace({}).range(marks[0].from, marks[0].to));
              // Hide from ] to end of link (covers ](url))
              deco.push(Decoration.replace({}).range(marks[1].from, nTo));
            }
          }
          return;
        }

        // ── Images ![alt](url) ──
        if (name === 'Image' && lpSettings.livePreviewImages) {
          const text = state.sliceDoc(nFrom, nTo);
          const imgMatch = text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
          if (imgMatch) {
            const alt = imgMatch[1];
            const rawUrl = imgMatch[2];
            const src = resolveImageSrc(rawUrl);
            if (src) {
              // Always show image widget — never reveal raw markdown
              deco.push(
                Decoration.replace({
                  widget: new ImageWidget(src, alt, rawUrl, nFrom, nTo),
                }).range(nFrom, nTo)
              );
              return;
            }
          }
          // Fallback for images we can't resolve
          if (!active) {
            deco.push(Decoration.mark({ class: 'cm-live-image' }).range(nFrom, nTo));
            const marks = nodeRef.node.getChildren('LinkMark');
            if (marks.length >= 2) {
              deco.push(Decoration.replace({}).range(nFrom, marks[0].to));
              deco.push(Decoration.replace({}).range(marks[1].from, nTo));
            }
          } else {
            deco.push(Decoration.mark({ class: 'cm-live-image' }).range(nFrom, nTo));
          }
          return;
        }

        // ── Tables ──
        if (name === 'Table') {
          const startLine = state.doc.lineAt(nFrom).number;
          const endLine = state.doc.lineAt(nTo).number;

          if (!active) {
            // Parse the table text into headers, delimiter, and data rows
            const headerLine = state.doc.line(startLine).text;
            const delimiterLine = startLine + 1 <= endLine ? state.doc.line(startLine + 1).text : '';
            const headers = parseTableRow(headerLine);
            const alignments = parseAlignments(delimiterLine);
            const rows: string[][] = [];
            for (let i = startLine + 2; i <= endLine; i++) {
              rows.push(parseTableRow(state.doc.line(i).text));
            }

            // Replace first line with the table widget (single-line replace only)
            const firstLine = state.doc.line(startLine);
            deco.push(
              Decoration.replace({
                widget: new TableWidget(headers, rows, alignments),
              }).range(firstLine.from, firstLine.to)
            );

            // Hide each subsequent line individually (avoids cross-line replace)
            for (let i = startLine + 1; i <= endLine; i++) {
              const line = state.doc.line(i);
              deco.push(Decoration.line({ class: 'cm-table-hidden-line' }).range(line.from));
              if (line.length > 0) {
                deco.push(Decoration.replace({}).range(line.from, line.to));
              }
            }
          } else {
            // When cursor is on the table, style it lightly
            for (let i = startLine; i <= endLine; i++) {
              deco.push(Decoration.line({ class: 'cm-table-source' }).range(state.doc.line(i).from));
            }
          }
          return false;
        }

        // ── Blockquote / Callout ──
        if (name === 'Blockquote') {
          const callout = parseCallout(state, nFrom);
          const startLine = state.doc.lineAt(nFrom).number;
          const endLine = state.doc.lineAt(nTo).number;

          if (callout) {
            // Apply callout styling to every line
            for (let i = startLine; i <= endLine; i++) {
              const classes = [`cm-callout`, `cm-callout-${callout.colorClass}`];
              if (i === startLine) classes.push('cm-callout-first');
              if (i === endLine) classes.push('cm-callout-last');
              deco.push(
                Decoration.line({ class: classes.join(' ') }).range(state.doc.line(i).from)
              );
            }

            if (!active) {
              // Replace entire first line with the callout header widget
              const firstLine = state.doc.lineAt(nFrom);
              const icon = CALLOUT_ICONS[callout.type] ?? 'i';
              deco.push(
                Decoration.replace({
                  widget: new CalloutHeaderWidget(icon, callout.title, callout.colorClass),
                }).range(firstLine.from, firstLine.to)
              );

              // Hide > markers on remaining lines via text scan
              for (let i = startLine + 1; i <= endLine; i++) {
                const line = state.doc.line(i);
                const m = line.text.match(/^>\s?/);
                if (m) {
                  deco.push(Decoration.replace({}).range(line.from, line.from + m[0].length));
                }
              }
            }
          } else {
            // Regular blockquote (no callout)
            for (let i = startLine; i <= endLine; i++) {
              deco.push(
                Decoration.line({ class: 'cm-live-blockquote' }).range(state.doc.line(i).from)
              );
            }
            if (!active) {
              for (let i = startLine; i <= endLine; i++) {
                const line = state.doc.line(i);
                const m = line.text.match(/^>\s?/);
                if (m) {
                  deco.push(Decoration.replace({}).range(line.from, line.from + m[0].length));
                }
              }
            }
          }
          return;
        }

        // ── Horizontal rule ──
        if (name === 'HorizontalRule') {
          if (!active) {
            deco.push(
              Decoration.replace({ widget: new HrWidget() }).range(nFrom, nTo)
            );
          }
          return;
        }

        // ── Task checkbox ──
        if (name === 'TaskMarker') {
          if (!active) {
            const text = state.sliceDoc(nFrom, nTo);
            const checked = text.includes('x') || text.includes('X');
            deco.push(
              Decoration.replace({ widget: new CheckboxWidget(checked) }).range(nFrom, nTo)
            );
          }
          return;
        }

        // ── Fenced code block ──
        if (name === 'FencedCode' && lpSettings.livePreviewCodeBlocks) {
          const startLine = state.doc.lineAt(nFrom).number;
          const endLine = state.doc.lineAt(nTo).number;

          // Skip frontmatter — handled by properties widget
          if (fmEndPos >= 0 && nFrom <= fmEndPos) return;

          // Skip live preview decorations if the block is folded
          // (fold placeholder conflicts with replace decorations)
          let isFolded = false;
          const folds = foldedRanges(state);
          folds.between(nFrom, nTo, () => { isFolded = true; });
          if (isFolded) return;

          for (let i = startLine; i <= endLine; i++) {
            const classes = ['cm-live-codeblock'];
            if (i === startLine) classes.push('cm-codeblock-first');
            if (i === endLine) classes.push('cm-codeblock-last');
            deco.push(
              Decoration.line({ class: classes.join(' ') }).range(state.doc.line(i).from)
            );
          }

          if (!active) {
            // Hide opening fence line (``` or ```lang)
            const openLine = state.doc.line(startLine);
            deco.push(Decoration.replace({}).range(openLine.from, openLine.to));

            // Hide closing fence line
            if (endLine > startLine) {
              const closeLine = state.doc.line(endLine);
              deco.push(Decoration.replace({}).range(closeLine.from, closeLine.to));
            }

            // Add copy button and lang badge on first code line
            const codeStart = startLine + 1;
            const codeEnd = endLine > startLine ? endLine - 1 : endLine;
            if (codeStart <= endLine) {
              // Extract code content
              const codeLines: string[] = [];
              for (let i = codeStart; i <= codeEnd; i++) {
                codeLines.push(state.doc.line(i).text);
              }
              const codeText = codeLines.join('\n');

              // Mark first code line as copy-button anchor
              deco.push(
                Decoration.line({ class: 'cm-codeblock-copy-line' }).range(state.doc.line(codeStart).from)
              );

              // Copy button (top-right of code block)
              deco.push(
                Decoration.widget({
                  widget: new CopyButtonWidget(codeText),
                  side: 1,
                }).range(state.doc.line(codeStart).to)
              );

              // Line numbers (if enabled)
              if (useSettingsStore.getState().codeBlockLineNumbers) {
                let num = 1;
                for (let i = codeStart; i <= codeEnd; i++) {
                  const line = state.doc.line(i);
                  deco.push(
                    Decoration.widget({
                      widget: new CodeLineNumberWidget(num),
                      side: -1,
                    }).range(line.from)
                  );
                  deco.push(
                    Decoration.line({ class: 'cm-codeblock-numbered' }).range(line.from)
                  );
                  num++;
                }
              }
            }
          }
          return;
        }
      },
    });
  }

  return Decoration.set(deco, true);
}

export function buildFrontmatterDecorations(state: EditorState): DecorationSet {
  const lpSettings = useSettingsStore.getState();
  if (!lpSettings.enableProperties) return Decoration.none;

  const fm = parseFrontmatter(state);
  if (!fm) return Decoration.none;

  const fmActive = cursorOnLines(state, 0, fm.endPos);
  if (fmActive) return Decoration.none;

  const firstLine = state.doc.line(1);
  const fmEndLine = state.doc.line(fm.endLine);
  return Decoration.set([
    Decoration.replace({
      widget: new PropertiesWidget(fm.properties, firstLine.from, fmEndLine.to),
      block: true,
    }).range(firstLine.from, fmEndLine.to),
  ]);
}
