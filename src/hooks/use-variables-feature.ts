import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';
import { useVaultStore } from '../stores/vault-store';
import { useToastStore } from '../stores/toast-store';
import { getVariablesOptions } from './use-variables-options';
import type { VariableMatch } from '../lib/tidemark';

export interface VariablesFeatureCallbacks {
  setSetVarModal: (modal: { name: string; currentValue: string } | null) => void;
  setListVarsModal: (vars: VariableMatch[] | null) => void;
}

export function useVariablesFeature(callbacks: VariablesFeatureCallbacks): void {
  const { t } = useTranslation(['common']);

  useEffect(() => {
    const { setSetVarModal, setListVarsModal } = callbacks;

    const handleReplaceAll = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      const vaultPath = useVaultStore.getState().vaultPath;
      if (!view || !vaultPath) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const opts = getVariablesOptions();

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      if (!fm) return;
      const frontmatter = parseFrontmatter(fm.raw);
      const body = doc.slice(fm.bodyStart);
      const replaced = replaceVariables(body, frontmatter, opts);
      if (replaced !== body) {
        view.dispatch({
          changes: { from: fm.bodyStart, to: doc.length, insert: replaced },
        });
      }
    };

    const handleCopyReplaced = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const opts = getVariablesOptions();

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      if (!fm) {
        await navigator.clipboard.writeText(doc);
        return;
      }
      const frontmatter = parseFrontmatter(fm.raw);
      const body = doc.slice(fm.bodyStart);
      const replaced = replaceVariables(body, frontmatter, opts);
      await navigator.clipboard.writeText(replaced);
    };

    const handleSetVariable = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, getVariableAtPosition } = await import('../lib/tidemark');
      const opts = getVariablesOptions();

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const bodyStart = fm?.bodyStart ?? 0;
      const body = doc.slice(bodyStart);
      const cursor = view.state.selection.main.head;
      const bodyOffset = cursor - bodyStart;

      const match = getVariableAtPosition(body, bodyOffset, frontmatter, opts);
      if (!match) {
        useToastStore.getState().addToast(t('common:noVariableAtCursor'), 'info');
        return;
      }

      const currentVal = match.status === 'exists' ? match.resolvedValue : '';
      setSetVarModal({ name: match.name, currentValue: currentVal });
    };

    const handleListVariables = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, scanDocumentVariables } = await import('../lib/tidemark');
      const opts = getVariablesOptions();

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const body = doc.slice(fm?.bodyStart ?? 0);
      const vars = scanDocumentVariables(body, frontmatter, opts);
      setListVarsModal(vars);
    };

    const handleCopyLineReplaced = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const opts = getVariablesOptions();

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      const replaced = replaceVariables(line.text, frontmatter, opts);
      await navigator.clipboard.writeText(replaced);
      useToastStore.getState().addToast(t('common:lineCopiedWithVariables'), 'success');
    };

    const handleCopySelectionReplaced = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const opts = getVariablesOptions();

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const { from, to } = view.state.selection.main;
      const selected = from === to
        ? view.state.doc.lineAt(from).text
        : view.state.sliceDoc(from, to);
      const replaced = replaceVariables(selected, frontmatter, opts);
      await navigator.clipboard.writeText(replaced);
      useToastStore.getState().addToast(t('common:selectionCopiedWithVariables'), 'success');
    };

    const handleReplaceSelection = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const opts = getVariablesOptions();

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const { from, to } = view.state.selection.main;
      if (from === to) return;
      const selected = view.state.sliceDoc(from, to);
      const replaced = replaceVariables(selected, frontmatter, opts);
      if (replaced !== selected) {
        view.dispatch({ changes: { from, to, insert: replaced } });
      }
    };

    window.addEventListener('cascade:variables-replace-all', handleReplaceAll);
    window.addEventListener('cascade:variables-copy-replaced', handleCopyReplaced);
    window.addEventListener('cascade:variables-set', handleSetVariable);
    window.addEventListener('cascade:variables-list', handleListVariables);
    window.addEventListener('cascade:variables-copy-line', handleCopyLineReplaced);
    window.addEventListener('cascade:variables-copy-selection', handleCopySelectionReplaced);
    window.addEventListener('cascade:variables-replace-selection', handleReplaceSelection);
    return () => {
      window.removeEventListener('cascade:variables-replace-all', handleReplaceAll);
      window.removeEventListener('cascade:variables-copy-replaced', handleCopyReplaced);
      window.removeEventListener('cascade:variables-set', handleSetVariable);
      window.removeEventListener('cascade:variables-list', handleListVariables);
      window.removeEventListener('cascade:variables-copy-line', handleCopyLineReplaced);
      window.removeEventListener('cascade:variables-copy-selection', handleCopySelectionReplaced);
      window.removeEventListener('cascade:variables-replace-selection', handleReplaceSelection);
    };
  }, [callbacks, t]);
}
