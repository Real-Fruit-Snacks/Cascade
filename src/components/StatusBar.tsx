import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';
import { usePluginStore } from '../stores/plugin-store';
import { useToastStore } from '../stores/toast-store';
import { SyncStatusIndicator } from './SyncStatusIndicator';
// B2: Lazily loaded only when vim mode is enabled
let _getCM: typeof import('@replit/codemirror-vim').getCM | null = null;
let _getCMLoading = false;

// R5: Shared DOM listener manager — one set of listeners shared across all status bar hooks
const sharedEditorSub = {
  listeners: new Set<() => void>(),
  dom: null as HTMLElement | null,
  rafId: 0,
  timerId: 0,
  notify() { for (const cb of sharedEditorSub.listeners) cb(); },
  deferredNotify() { sharedEditorSub.rafId = requestAnimationFrame(sharedEditorSub.notify); },
  // Notify after a microtask so vim plugin has processed the keydown first
  postKeyNotify() {
    clearTimeout(sharedEditorSub.timerId);
    sharedEditorSub.timerId = window.setTimeout(sharedEditorSub.notify, 1);
  },
  attach(dom: HTMLElement) {
    if (sharedEditorSub.dom === dom) return;
    sharedEditorSub.detach();
    sharedEditorSub.dom = dom;
    dom.addEventListener('keyup', sharedEditorSub.notify);
    dom.addEventListener('mouseup', sharedEditorSub.notify);
    dom.addEventListener('click', sharedEditorSub.notify);
    dom.addEventListener('keydown', sharedEditorSub.postKeyNotify);
    dom.addEventListener('focus', sharedEditorSub.notify, true);
  },
  detach() {
    const d = sharedEditorSub.dom;
    if (!d) return;
    cancelAnimationFrame(sharedEditorSub.rafId);
    clearTimeout(sharedEditorSub.timerId);
    d.removeEventListener('keyup', sharedEditorSub.notify);
    d.removeEventListener('mouseup', sharedEditorSub.notify);
    d.removeEventListener('click', sharedEditorSub.notify);
    d.removeEventListener('keydown', sharedEditorSub.postKeyNotify);
    d.removeEventListener('focus', sharedEditorSub.notify, true);
    sharedEditorSub.dom = null;
  },
};

function useEditorSubscribe() {
  const editorViewRef = useEditorStore((s) => s.editorViewRef);

  const subscribe = useMemo(() => (cb: () => void) => {
    const view = editorViewRef.current;
    if (!view) return () => {};
    sharedEditorSub.attach(view.dom);
    sharedEditorSub.listeners.add(cb);
    return () => {
      sharedEditorSub.listeners.delete(cb);
      if (sharedEditorSub.listeners.size === 0) sharedEditorSub.detach();
    };
  }, [editorViewRef]);

  return subscribe;
}

function useCursorPosition() {
  const editorViewRef = useEditorStore((s) => s.editorViewRef);
  const subscribe = useEditorSubscribe();

  const getSnapshot = useMemo(() => () => {
    const view = editorViewRef.current;
    if (!view) return '1:1';
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    return `${line.number}:${pos - line.from + 1}`;
  }, [editorViewRef]);

  return useSyncExternalStore(subscribe, getSnapshot, () => '1:1');
}

export function useVimMode(): string | null {
  const vimEnabled = useSettingsStore((s) => s.vimMode);
  const editorViewRef = useEditorStore((s) => s.editorViewRef);
  const subscribe = useEditorSubscribe();
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (vimEnabled && !_getCM && !_getCMLoading) {
      _getCMLoading = true;
      import('@replit/codemirror-vim').then((m) => {
        _getCM = m.getCM;
        _getCMLoading = false;
        forceUpdate((n) => n + 1);
      }).catch(() => { _getCMLoading = false; });
    }
  }, [vimEnabled]);

  const getSnapshot = useMemo(() => () => {
    if (!vimEnabled) return '';
    const view = editorViewRef.current;
    if (!view) return 'NORMAL';
    if (!_getCM) return 'NORMAL';
    const cm = _getCM(view);
    if (!cm) return 'NORMAL';
    const vimState = cm.state.vim;
    if (!vimState) return 'NORMAL';
    if (vimState.insertMode) return 'INSERT';
    if (vimState.visualMode) return vimState.visualLine ? 'V-LINE' : vimState.visualBlock ? 'V-BLOCK' : 'VISUAL';
    if (vimState.mode === 'replace') return 'REPLACE';
    return 'NORMAL';
  }, [vimEnabled, editorViewRef]);

  const mode = useSyncExternalStore(subscribe, getSnapshot, () => '');
  return vimEnabled ? mode : null;
}

function useSelectionStats() {
  const editorViewRef = useEditorStore((s) => s.editorViewRef);
  const subscribe = useEditorSubscribe();

  const getSnapshot = useMemo(() => () => {
    const view = editorViewRef.current;
    if (!view) return '';
    const { from, to } = view.state.selection.main;
    if (from === to) return '';
    const selectedText = view.state.sliceDoc(from, to);
    const words = selectedText.match(/\S+/g)?.length ?? 0;
    const chars = selectedText.length;
    return `${words}:${chars}`;
  }, [editorViewRef]);

  return useSyncExternalStore(subscribe, getSnapshot, () => '');
}

function useDocStats() {
  const editorViewRef = useEditorStore((s) => s.editorViewRef);
  const subscribe = useEditorSubscribe();

  const lastDocRef = useRef<{ doc: unknown; result: string }>({ doc: null, result: '0:0:0' });
  const getSnapshot = useMemo(() => () => {
    const view = editorViewRef.current;
    if (!view) return '0:0:0';
    const doc = view.state.doc;
    // Cache: only recompute when document identity changes
    if (doc === lastDocRef.current.doc) return lastDocRef.current.result;
    const len = doc.length;
    let words = 0;
    if (len > 0) {
      const iter = doc.iter();
      while (!iter.done) {
        const matches = iter.value.match(/\S+/g);
        if (matches) words += matches.length;
        iter.next();
      }
    }
    const readingTime = Math.ceil(words / 200);
    const result = `${words}:${len}:${readingTime}`;
    lastDocRef.current = { doc, result };
    return result;
  }, [editorViewRef]);

  return useSyncExternalStore(subscribe, getSnapshot, () => '0:0:0');
}

export function StatusBar() {
  const { t } = useTranslation('statusbar');
  const isDirty = useEditorStore((s) => s.isDirty);
  const justSaved = useEditorStore((s) => s.justSaved);
  const cursor = useCursorPosition();
  const vimMode = useVimMode();
  const pluginStatusBarItems = usePluginStore((s) => s.statusBarItems);
  const showWords = useSettingsStore((s) => s.statusBarWords);
  const showChars = useSettingsStore((s) => s.statusBarChars);
  const showReadingTime = useSettingsStore((s) => s.statusBarReadingTime);
  const showSelection = useSettingsStore((s) => s.statusBarSelection);
  const enableWordCountGoal = useSettingsStore((s) => s.enableWordCountGoal);
  const wordCountGoalTarget = useSettingsStore((s) => s.wordCountGoalTarget);
  const wordCountGoalShowStatusBar = useSettingsStore((s) => s.wordCountGoalShowStatusBar);
  const wordCountGoalNotify = useSettingsStore((s) => s.wordCountGoalNotify);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);

  const goalNotifiedRef = useRef(false);

  const selectionRaw = useSelectionStats();
  const selection = useMemo(() => {
    if (!selectionRaw) return null;
    const [w, c] = selectionRaw.split(':').map(Number);
    return { words: w, chars: c };
  }, [selectionRaw]);

  const statsRaw = useDocStats();
  const stats = useMemo(() => {
    const [w, c, r] = statsRaw.split(':').map(Number);
    return { words: w, chars: c, readingTime: r };
  }, [statsRaw]);

  // Reset notification ref when active file changes
  useEffect(() => {
    goalNotifiedRef.current = false;
  }, [activeFilePath]);

  // Fire toast when word count goal is reached
  useEffect(() => {
    if (enableWordCountGoal && wordCountGoalNotify && stats.words >= wordCountGoalTarget && wordCountGoalTarget > 0) {
      if (!goalNotifiedRef.current) {
        goalNotifiedRef.current = true;
        useToastStore.getState().addToast(t('toast.goalReached'), 'success');
      }
    } else if (stats.words < wordCountGoalTarget) {
      goalNotifiedRef.current = false;
    }
  }, [enableWordCountGoal, wordCountGoalNotify, stats.words, wordCountGoalTarget]);

  const [cursorLine, cursorCol] = cursor.split(':');

  return (
    <div
      className="flex items-center shrink-0 px-3 select-none"
      style={{
        backgroundColor: 'var(--ctp-crust)',
        borderTop: '1px solid var(--ctp-surface0)',
        height: 24,
        fontSize: '0.6875rem',
        color: 'var(--ctp-overlay1)',
      }}
    >
      {vimMode && (
        <>
          <span
            className="px-1.5 py-px rounded font-semibold"
            style={{
              fontSize: '0.625rem',
              backgroundColor: vimMode === 'INSERT' ? 'var(--ctp-green)'
                : vimMode === 'VISUAL' || vimMode === 'V-LINE' || vimMode === 'V-BLOCK' ? 'var(--ctp-mauve)'
                : vimMode === 'REPLACE' ? 'var(--ctp-red)'
                : 'var(--ctp-blue)',
              color: 'var(--ctp-base)',
            }}
          >
            {vimMode}
          </span>
          <Divider />
        </>
      )}
      <span>
        {t('cursor.line')} <span style={{ color: 'var(--ctp-accent)' }}>{cursorLine}</span>
        {', '}
        {t('cursor.column')} <span style={{ color: 'var(--ctp-accent)' }}>{cursorCol}</span>
      </span>
      {showWords && (
        <>
          <Divider />
          <span>{t('words', { count: stats.words })}</span>
        </>
      )}
      {showChars && (
        <>
          <Divider />
          <span>{t('chars', { count: stats.chars })}</span>
        </>
      )}
      {showReadingTime && (
        <>
          <Divider />
          <span>{t('readingTime', { count: stats.readingTime })}</span>
        </>
      )}
      {enableWordCountGoal && wordCountGoalShowStatusBar && (
        <>
          <Divider />
          <span style={{ color: stats.words >= wordCountGoalTarget ? 'var(--ctp-green)' : 'var(--ctp-overlay1)' }}>
            {stats.words}/{wordCountGoalTarget}
            {stats.words >= wordCountGoalTarget ? ` ${t('goalReached')}` : ''}
          </span>
        </>
      )}
      {showSelection && selection && (
        <>
          <Divider />
          <span style={{ color: 'var(--ctp-accent)' }}>
            {t('selection', { words: selection.words, chars: selection.chars })}
          </span>
        </>
      )}

      {/* Spacer pushes right-side items to the far right */}
      <span style={{ flex: 1 }} />

      {/* Sync status */}
      <SyncStatusIndicator />
      <Divider />

      {/* Right side */}
      {Array.from(pluginStatusBarItems.entries()).map(([id, item], index) => (
        <span key={id} style={{ display: 'flex', alignItems: 'center' }}>
          {index > 0 && <Divider />}
          <span
            style={{ color: 'var(--ctp-subtext0)', cursor: item.onClick ? 'pointer' : 'default' }}
            onClick={item.onClick}
          >
            {item.text}
          </span>
        </span>
      ))}
      {justSaved && (
        <>
          {pluginStatusBarItems.size > 0 && <Divider />}
          <span style={{ color: 'var(--ctp-green)' }}>{t('saved')}</span>
        </>
      )}
      {isDirty && !justSaved && (
        <>
          {pluginStatusBarItems.size > 0 && <Divider />}
          <span style={{ color: 'var(--ctp-peach)' }} title={t('unsavedChanges')}>●</span>
        </>
      )}
      {activeFilePath && (
        <>
          {(pluginStatusBarItems.size > 0 || justSaved || isDirty) && <Divider />}
          <span>{t('fileType')}</span>
        </>
      )}
    </div>
  );
}

function Divider() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 1,
        height: 12,
        backgroundColor: 'var(--ctp-surface1)',
        margin: '0 8px',
        flexShrink: 0,
      }}
    />
  );
}
