import React, { useMemo } from 'react';
import { Scissors, Copy, ClipboardPaste, MousePointerClick, Pencil, CopyCheck, FileOutput, Replace, SpellCheck, BookPlus, EyeOff } from 'lucide-react';
import { useSettingsStore } from '../stores/settings-store';
import { usePluginStore } from '../stores/plugin-store';
import { useToastStore } from '../stores/toast-store';
import { extractFrontmatter, parseFrontmatter, getVariableAtPosition } from '../lib/tidemark';
import { triggerSpellcheckRebuild } from '../editor/custom-spellcheck';
import { getSuggestions, addToCustomDictionary, ignoreWord } from '../editor/spellcheck-engine';
import type { MenuItem } from '../components/sidebar/ContextMenu';
import type { EditorView } from '@codemirror/view';
import type { TFunction } from 'i18next';
import { emit } from '../lib/cascade-events';

interface EditorMenuState {
  x: number;
  y: number;
  docPos: number | null;
  spellcheck: { word: string; from: number; to: number } | null;
}

interface UseEditorContextMenuParams {
  editorMenu: EditorMenuState | null;
  getView: () => EditorView | null;
  t: TFunction<'editor'>;
}

export function useEditorContextMenu({ editorMenu, getView, t }: UseEditorContextMenuParams): MenuItem[] {
  return useMemo((): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: t('editorContextMenu.cut'),
        icon: React.createElement(Scissors, { size: 12 }),
        color: 'var(--ctp-peach)',
        onClick: () => {
          const view = getView();
          if (view) {
            const { from, to } = view.state.selection.main;
            const selected = view.state.sliceDoc(from, to);
            if (selected) {
              navigator.clipboard.writeText(selected);
              view.dispatch({ changes: { from, to, insert: '' } });
            }
          }
        },
      },
      {
        label: t('editorContextMenu.copy'),
        icon: React.createElement(Copy, { size: 12 }),
        color: 'var(--ctp-blue)',
        onClick: () => {
          const view = getView();
          if (view) {
            const { from, to } = view.state.selection.main;
            const selected = view.state.sliceDoc(from, to);
            if (selected) navigator.clipboard.writeText(selected);
          }
        },
      },
      {
        label: t('editorContextMenu.paste'),
        icon: React.createElement(ClipboardPaste, { size: 12 }),
        color: 'var(--ctp-green)',
        onClick: () => {
          navigator.clipboard.readText().then((text) => {
            const view = getView();
            if (view) {
              const { from, to } = view.state.selection.main;
              view.dispatch({ changes: { from, to, insert: text } });
            }
          });
        },
      },
      {
        label: t('editorContextMenu.selectAll'),
        icon: React.createElement(MousePointerClick, { size: 12 }),
        color: 'var(--ctp-mauve)',
        onClick: () => {
          const view = getView();
          if (view) {
            view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
          }
        },
      },
    ];

    if (useSettingsStore.getState().enableVariables) {
      // Detect variable at click position
      let variableMatch: { name: string } | null = null;
      const view = getView();
      if (view && editorMenu?.docPos !== null && editorMenu?.docPos !== undefined) {
        const s = useSettingsStore.getState();
        const opts = {
          openDelimiter: s.variablesOpenDelimiter,
          closeDelimiter: s.variablesCloseDelimiter,
          defaultSeparator: s.variablesDefaultSeparator,
          missingValueText: s.variablesMissingText,
          supportNesting: s.variablesSupportNesting,
          caseInsensitive: s.variablesCaseInsensitive,
          arrayJoinSeparator: s.variablesArrayJoinSeparator,
          preserveOnMissing: s.variablesPreserveOnMissing,
        };
        const doc = view.state.doc.toString();
        const fm = extractFrontmatter(doc);
        const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
        const bodyStart = fm?.bodyStart ?? 0;
        const body = doc.slice(bodyStart);
        const bodyOffset = editorMenu.docPos - bodyStart;
        if (bodyOffset >= 0) {
          variableMatch = getVariableAtPosition(body, bodyOffset, frontmatter, opts);
        }
      }

      items.push({
        label: '', separator: true, onClick: () => {},
      });

      // Only show "Set Variable" when a variable is under the mouse
      if (variableMatch) {
        const clickDocPos = editorMenu?.docPos ?? null;
        items.push({
          label: t('editorContextMenu.setVariable', { name: variableMatch.name }),
          icon: React.createElement(Pencil, { size: 12 }),
          color: 'var(--ctp-green)',
          onClick: () => {
            // Move cursor to right-click position so the handler finds the variable
            const v = getView();
            if (v && clickDocPos !== null) {
              v.dispatch({ selection: { anchor: clickDocPos } });
            }
            // Dispatch after cursor update has been processed
            requestAnimationFrame(() => {
              emit('cascade:variables-set');
            });
          },
        });
      }

      items.push({
        label: t('editorContextMenu.copyLineReplaced'),
        icon: React.createElement(CopyCheck, { size: 12 }),
        color: 'var(--ctp-blue)',
        onClick: () => emit('cascade:variables-copy-line'),
      });
      items.push({
        label: t('editorContextMenu.copySelectionReplaced'),
        icon: React.createElement(FileOutput, { size: 12 }),
        color: 'var(--ctp-blue)',
        onClick: () => emit('cascade:variables-copy-selection'),
      });
      items.push({
        label: t('editorContextMenu.replaceInSelection'),
        icon: React.createElement(Replace, { size: 12 }),
        color: 'var(--ctp-peach)',
        onClick: () => emit('cascade:variables-replace-selection'),
      });
    }

    // Prepend spellcheck items if right-clicked on a misspelled word
    if (editorMenu?.spellcheck) {
      const { word, from, to } = editorMenu.spellcheck;
      const suggestions = getSuggestions(word, 5);
      const spellItems: MenuItem[] = [];

      if (suggestions.length > 0) {
        for (const suggestion of suggestions) {
          spellItems.push({
            label: suggestion,
            icon: React.createElement(SpellCheck, { size: 12 }),
            color: 'var(--ctp-green)',
            onClick: () => {
              const view = getView();
              if (view) {
                view.dispatch({ changes: { from, to, insert: suggestion } });
              }
            },
          });
        }
      } else {
        spellItems.push({
          label: t('editorContextMenu.noSuggestions'),
          icon: React.createElement(SpellCheck, { size: 12 }),
          color: 'var(--ctp-overlay0)',
          onClick: () => {},
        });
      }

      spellItems.push({
        label: '', separator: true, onClick: () => {},
      });

      spellItems.push({
        label: t('editorContextMenu.addToDictionary'),
        icon: React.createElement(BookPlus, { size: 12 }),
        color: 'var(--ctp-blue)',
        onClick: () => {
          addToCustomDictionary(word);
          const view = getView();
          if (view) triggerSpellcheckRebuild(view);
          useToastStore.getState().addToast(t('toast.addedToDictionary', { word }), 'success');
        },
      });

      spellItems.push({
        label: t('editorContextMenu.ignore'),
        icon: React.createElement(EyeOff, { size: 12 }),
        color: 'var(--ctp-overlay1)',
        onClick: () => {
          ignoreWord(word);
          const view = getView();
          if (view) triggerSpellcheckRebuild(view);
        },
      });

      // Add separator before standard items
      spellItems.push({
        label: '', separator: true, onClick: () => {},
      });

      return [...spellItems, ...items];
    }

    // Append plugin editor context menu items
    const pluginEditorItems = Array.from(usePluginStore.getState().contextMenuItems.values())
      .filter((item) => item.context === 'editor')
      .map((item) => ({
        label: item.label,
        onClick: () => item.sandbox.invokeCallback(item.runCallbackId),
      }));
    if (pluginEditorItems.length > 0) {
      items.push({ label: '', separator: true, onClick: () => {} });
      items.push(...pluginEditorItems);
    }

    return items;
  }, [getView, editorMenu, t]);
}
