import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpLeft, ArrowLeftRight, FileText, Folder, Link2, Search, X } from 'lucide-react';
import { useVaultStore } from '../../stores/vault-store';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore } from '../../stores/settings-store';
import { SkeletonLine } from '../Skeleton';
import { resolveWikiLink } from '../../lib/wiki-link-resolver';
import { parseFileParts } from '../../lib/path-utils';
import * as cmd from '../../lib/tauri-commands';

/** Strip [[brackets]] from wiki-links for display. Shows display text if piped. */
function cleanWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_m, target, display) => display ?? target);
}

interface LinkResult {
  filePath: string;
  fileName: string;
  dir: string | null;
  contextLines: string[];
  /** 1-based line numbers parallel to contextLines (only set for unlinked mentions) */
  contextLineNumbers?: number[];
}


function FileItem({
  result,
  onOpen,
  accentColor,
  contextLineCount,
}: {
  result: LinkResult;
  onOpen: (e: React.MouseEvent) => void;
  accentColor: string;
  contextLineCount: number;
}) {
  return (
    <button
      className="flex flex-col gap-0.5 w-full px-2 py-1.5 text-xs rounded text-left hover:bg-[var(--ctp-surface0)] transition-colors"
      onClick={onOpen}
    >
      <div className="flex items-center gap-2" style={{ color: 'var(--ctp-subtext1)' }}>
        <FileText size={12} style={{ color: accentColor, flexShrink: 0 }} />
        <span className="truncate font-medium">{result.fileName}</span>
        {result.dir && (
          <span className="truncate text-[10px] ml-auto" style={{ color: 'var(--ctp-overlay0)' }}>
            {result.dir}
          </span>
        )}
      </div>
      {result.contextLines.length > 0 && (
        <div className="pl-5 space-y-0.5">
          {result.contextLines.slice(0, contextLineCount).map((line, i) => (
            <div
              key={i}
              className="truncate"
              style={{ color: 'var(--ctp-overlay1)', fontSize: '0.6875rem' }}
            >
              {cleanWikiLinks(line)}
            </div>
          ))}
          {result.contextLines.length > contextLineCount && (
            <div style={{ color: 'var(--ctp-overlay0)', fontSize: '0.625rem' }}>
              +{result.contextLines.length - contextLineCount} more
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  count,
  color,
  collapsed,
  onToggle,
}: {
  icon: typeof ArrowUpLeft;
  label: string;
  count: number;
  color: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-semibold sticky top-0 z-10"
      style={{ backgroundColor: 'var(--ctp-mantle)', color }}
    >
      <Icon size={12} />
      <span>{label}</span>
      <span
        className="px-1.5 py-0.5 rounded-full text-[10px] font-normal"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color }}
      >
        {count}
      </span>
      <span
        className="ml-auto text-[10px] font-normal"
        style={{ color: 'var(--ctp-overlay0)' }}
      >
        {collapsed ? '▸' : '▾'}
      </span>
    </button>
  );
}

function GroupedResults({
  results,
  accentColor,
  contextLineCount,
  vaultPath,
  openFile,
  rootLabel,
}: {
  results: LinkResult[];
  accentColor: string;
  contextLineCount: number;
  vaultPath: string | null;
  openFile: (vaultPath: string, filePath: string, newTab: boolean) => void;
  rootLabel: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, LinkResult[]>();
    for (const r of results) {
      const key = r.dir ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Sort: root first, then folders alphabetically
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '' && b === '') return 0;
      if (a === '') return -1;
      if (b === '') return 1;
      return a.localeCompare(b);
    });
  }, [results]);

  return (
    <>
      {groups.map(([folder, items]) => (
        <div key={folder}>
          <div
            className="flex items-center gap-1.5 px-2 pt-2 pb-0.5"
            style={{ color: 'var(--ctp-overlay0)', fontSize: '0.625rem' }}
          >
            <Folder size={10} style={{ flexShrink: 0 }} />
            <span className="truncate">{folder === '' ? rootLabel : folder}</span>
          </div>
          {items.map((r) => (
            <FileItem
              key={r.filePath}
              result={r}
              accentColor={accentColor}
              contextLineCount={contextLineCount}
              onOpen={(e) => { if (vaultPath) openFile(vaultPath, r.filePath, e.ctrlKey || e.metaKey); }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export function BacklinksPanel() {
  const { t } = useTranslation('sidebar');

  const backlinkIndex = useVaultStore((s) => s.backlinkIndex);
  const flatFiles = useVaultStore((s) => s.flatFiles);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const isIndexing = useVaultStore((s) => s.isIndexing);
  const content = useEditorStore((s) => s.content);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const openFile = useEditorStore((s) => s.openFile);
  const backlinksContextLines = useSettingsStore((s) => s.backlinksContextLines);
  const backlinksGroupByFolder = useSettingsStore((s) => s.backlinksGroupByFolder);
  const [search, setSearch] = useState('');
  const [incomingResults, setIncomingResults] = useState<LinkResult[]>([]);
  const [unlinkedResults, setUnlinkedResults] = useState<LinkResult[]>([]);
  const [outCollapsed, setOutCollapsed] = useState(false);
  const [inCollapsed, setInCollapsed] = useState(false);
  const [unlinkedCollapsed, setUnlinkedCollapsed] = useState(true);

  // ── Outgoing links: files this note links to ──
  const deferredContent = useDeferredValue(content);
  const outgoingResults = useMemo<LinkResult[]>(() => {
    if (!activeFilePath || !deferredContent) return [];

    const seen = new Set<string>();
    const results: LinkResult[] = [];
    const WIKI_LINK_RE = /\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g;

    let match: RegExpExecArray | null;
    while ((match = WIKI_LINK_RE.exec(deferredContent)) !== null) {
      const target = match[1];
      const resolved = resolveWikiLink(target, flatFiles);
      if (!resolved || resolved === activeFilePath || seen.has(resolved)) continue;
      seen.add(resolved);

      const { fileName, dir } = parseFileParts(resolved);
      // Get the line containing this link as context
      const lineStart = deferredContent.lastIndexOf('\n', match.index) + 1;
      const lineEnd = deferredContent.indexOf('\n', match.index);
      const line = deferredContent.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();

      results.push({ filePath: resolved, fileName, dir, contextLines: [line] });
    }

    return results;
  }, [activeFilePath, deferredContent, flatFiles]);

  // ── Incoming links: derive key from active file ──
  const activeKey = useMemo(() => {
    if (!activeFilePath) return null;
    return activeFilePath.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
  }, [activeFilePath]);

  const incomingFiles = useMemo(() => {
    if (!activeKey) return [];
    const files: string[] = [];
    const activeFileName = activeKey.split('/').pop() ?? activeKey;

    for (const [target, sourceFiles] of backlinkIndex) {
      const targetNorm = target.toLowerCase();
      if (targetNorm === activeKey || targetNorm === activeFileName) {
        for (const f of sourceFiles) {
          if (f !== activeFilePath && !files.includes(f)) {
            files.push(f);
          }
        }
      }
    }
    return files.sort();
  }, [activeKey, activeFilePath, backlinkIndex]);

  // Load context lines for incoming links
  useEffect(() => {
    if (!vaultPath || !activeFilePath || incomingFiles.length === 0) {
      setIncomingResults([]);
      return;
    }

    let cancelled = false;
    const activeFileName = activeFilePath
      .replace(/\\/g, '/')
      .replace(/\.md$/i, '')
      .split('/')
      .pop() ?? '';

    const escaped = activeFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\[\\[${escaped}(\\|[^\\]]*)?\\]\\]`, 'i');

    Promise.all(
      incomingFiles.map(async (filePath) => {
        try {
          const text = await cmd.readFile(vaultPath, filePath);
          const lines = text.split('\n');
          const contextLines: string[] = [];
          for (const line of lines) {
            if (re.test(line)) contextLines.push(line.trim());
          }
          const { fileName, dir } = parseFileParts(filePath);
          return { filePath, fileName, dir, contextLines } as LinkResult;
        } catch {
          return null;
        }
      })
    ).then((loaded) => {
      if (cancelled) return;
      setIncomingResults(loaded.filter((r): r is LinkResult => r !== null));
    });

    return () => { cancelled = true; };
  }, [vaultPath, activeFilePath, incomingFiles]);

  // ── Unlinked mentions: files containing the note title as bare text ──
  const noteTitle = useMemo(() => {
    if (!activeFilePath) return null;
    return activeFilePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') ?? null;
  }, [activeFilePath]);

  useEffect(() => {
    if (!vaultPath || !noteTitle || !activeFilePath || unlinkedCollapsed) {
      setUnlinkedResults([]);
      return;
    }

    let cancelled = false;
    const escaped = noteTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the title as a whole word, case-insensitive
    const bareRe = new RegExp(`\\b${escaped}\\b`, 'i');
    // Match [[title...]] links to exclude
    const linkedRe = new RegExp(`\\[\\[${escaped}(\\|[^\\]]*)?\\]\\]`, 'i');

    cmd.searchVault(vaultPath, noteTitle, false, false, false).then(async (matches) => {
      if (cancelled) return;
      // Group by file, exclude current file
      const fileSet = new Set<string>();
      for (const m of matches) {
        if (m.filePath !== activeFilePath) fileSet.add(m.filePath);
      }

      const fileList = Array.from(fileSet);
      const fileContents = await Promise.all(
        fileList.map(async (filePath) => {
          try {
            const text = await cmd.readFile(vaultPath, filePath);
            return { filePath, text };
          } catch {
            return null;
          }
        })
      );

      const results: LinkResult[] = [];
      for (const entry of fileContents) {
        if (cancelled || !entry) continue;
        const { filePath, text } = entry;
        const lines = text.split('\n');
        const contextLines: string[] = [];
        const contextLineNumbers: number[] = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (bareRe.test(line) && !linkedRe.test(line)) {
            contextLines.push(line.trim());
            contextLineNumbers.push(i + 1); // 1-based
          }
        }
        if (contextLines.length > 0) {
          const { fileName, dir } = parseFileParts(filePath);
          results.push({ filePath, fileName, dir, contextLines, contextLineNumbers });
        }
      }

      if (!cancelled) setUnlinkedResults(results);
    }).catch(() => {
      if (!cancelled) setUnlinkedResults([]);
    });

    return () => { cancelled = true; };
  }, [vaultPath, activeFilePath, noteTitle, unlinkedCollapsed]);

  // ── Link a bare mention ──
  const handleLinkMention = useCallback(async (filePath: string, lineText: string, lineNumber: number) => {
    if (!vaultPath || !noteTitle) return;
    try {
      const text = await cmd.readFile(vaultPath, filePath);
      const escaped = noteTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const bareRe = new RegExp(`\\b(${escaped})\\b`, 'i');
      const lines = text.split('\n');
      const idx = lineNumber - 1;
      if (idx >= 0 && idx < lines.length) {
        lines[idx] = lines[idx].replace(bareRe, '[[' + noteTitle + ']]');
      }
      const newText = lines.join('\n');
      if (newText !== text) {
        await cmd.writeFile(vaultPath, filePath, newText);
        // Refresh unlinked results
        setUnlinkedResults((prev) => {
          const updated = prev.map((r) => {
            if (r.filePath !== filePath) return r;
            const remaining = r.contextLines.filter((l) => l !== lineText);
            const remainingNumbers = r.contextLineNumbers?.filter((_, i) => r.contextLines[i] !== lineText);
            return remaining.length > 0
              ? { ...r, contextLines: remaining, contextLineNumbers: remainingNumbers }
              : null;
          }).filter((r): r is LinkResult => r !== null);
          return updated;
        });
      }
    } catch { /* ignore */ }
  }, [vaultPath, noteTitle]);

  // ── Filter by search ──
  const filteredOutgoing = useMemo(() => {
    if (!search) return outgoingResults;
    const q = search.toLowerCase();
    return outgoingResults.filter((r) =>
      r.fileName.toLowerCase().includes(q) || r.contextLines.some((l) => l.toLowerCase().includes(q))
    );
  }, [outgoingResults, search]);

  const filteredIncoming = useMemo(() => {
    if (!search) return incomingResults;
    const q = search.toLowerCase();
    return incomingResults.filter((r) =>
      r.fileName.toLowerCase().includes(q) || r.contextLines.some((l) => l.toLowerCase().includes(q))
    );
  }, [incomingResults, search]);

  const filteredUnlinked = useMemo(() => {
    if (!search) return unlinkedResults;
    const q = search.toLowerCase();
    return unlinkedResults.filter((r) =>
      r.fileName.toLowerCase().includes(q) || r.contextLines.some((l) => l.toLowerCase().includes(q))
    );
  }, [unlinkedResults, search]);

  const totalCount = filteredOutgoing.length + filteredIncoming.length + filteredUnlinked.length;

  if (!activeFilePath) {
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider shrink-0"
          style={{ color: 'var(--ctp-overlay1)', borderBottom: '1px solid var(--ctp-surface1)' }}
        >
          <ArrowLeftRight size={12} />
          {t('panels.backlinks')}
        </div>
        <div
          className="flex flex-col items-center justify-center flex-1 gap-2 px-4"
          style={{ color: 'var(--ctp-overlay0)' }}
        >
          <ArrowLeftRight size={24} strokeWidth={1} />
          <p className="text-xs text-center">{t('emptyStates.openNoteToSeeLinks')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider shrink-0"
        style={{ color: 'var(--ctp-overlay1)', borderBottom: '1px solid var(--ctp-surface1)' }}
      >
        <ArrowLeftRight size={12} />
        {t('panels.backlinks')}
        {totalCount > 0 && (
          <span style={{ color: 'var(--ctp-overlay0)' }}>{totalCount}</span>
        )}
      </div>

      {/* Search */}
      <div className="px-2 py-1 shrink-0">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
          style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)' }}
        >
          <Search size={12} style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filters.filterLinks')}
            className="flex-1 bg-transparent outline-none placeholder:text-[var(--ctp-overlay0)]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="rounded p-0.5 hover:bg-[var(--ctp-surface1)] transition-colors"
              style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Link sections */}
      <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
        {isIndexing && backlinkIndex.size === 0 ? (
          <div className="flex flex-col gap-2 px-3 py-2">
            <SkeletonLine width="70%" />
            <SkeletonLine width="55%" />
            <SkeletonLine width="80%" />
            <SkeletonLine width="62%" />
            <SkeletonLine width="75%" />
            <SkeletonLine width="48%" />
          </div>
        ) : null}
        {/* Outgoing links */}
        <SectionHeader
          icon={ArrowDownRight}
          label={t('backlinks.outgoing')}
          count={filteredOutgoing.length}
          color="var(--ctp-blue)"
          collapsed={outCollapsed}
          onToggle={() => setOutCollapsed((c) => !c)}
        />
        {!outCollapsed && (
          <div className="px-1 pb-1">
            {filteredOutgoing.length === 0 ? (
              <div className="px-2 py-2 text-[11px]" style={{ color: 'var(--ctp-overlay0)' }}>
                {t('emptyStates.noOutgoingLinks')}
              </div>
            ) : backlinksGroupByFolder ? (
              <GroupedResults
                results={filteredOutgoing}
                accentColor="var(--ctp-blue)"
                contextLineCount={backlinksContextLines}
                vaultPath={vaultPath}
                openFile={openFile}
                rootLabel={t('fileTree.root')}
              />
            ) : (
              filteredOutgoing.map((r) => (
                <FileItem
                  key={r.filePath}
                  result={r}
                  accentColor="var(--ctp-blue)"
                  contextLineCount={backlinksContextLines}
                  onOpen={(e) => { if (vaultPath) openFile(vaultPath, r.filePath, e.ctrlKey || e.metaKey); }}
                />
              ))
            )}
          </div>
        )}

        {/* Incoming links */}
        <SectionHeader
          icon={ArrowUpLeft}
          label={t('backlinks.incoming')}
          count={filteredIncoming.length}
          color="var(--ctp-accent)"
          collapsed={inCollapsed}
          onToggle={() => setInCollapsed((c) => !c)}
        />
        {!inCollapsed && (
          <div className="px-1 pb-1">
            {filteredIncoming.length === 0 ? (
              <div className="px-2 py-2 text-[11px]" style={{ color: 'var(--ctp-overlay0)' }}>
                {t('emptyStates.noIncomingLinks')}
              </div>
            ) : backlinksGroupByFolder ? (
              <GroupedResults
                results={filteredIncoming}
                accentColor="var(--ctp-accent)"
                contextLineCount={backlinksContextLines}
                vaultPath={vaultPath}
                openFile={openFile}
                rootLabel={t('fileTree.root')}
              />
            ) : (
              filteredIncoming.map((r) => (
                <FileItem
                  key={r.filePath}
                  result={r}
                  accentColor="var(--ctp-accent)"
                  contextLineCount={backlinksContextLines}
                  onOpen={(e) => { if (vaultPath) openFile(vaultPath, r.filePath, e.ctrlKey || e.metaKey); }}
                />
              ))
            )}
          </div>
        )}

        {/* Unlinked mentions */}
        <SectionHeader
          icon={Link2}
          label={t('backlinks.unlinked')}
          count={filteredUnlinked.length}
          color="var(--ctp-yellow)"
          collapsed={unlinkedCollapsed}
          onToggle={() => setUnlinkedCollapsed((c) => !c)}
        />
        {!unlinkedCollapsed && (
          <div className="px-1 pb-1">
            {filteredUnlinked.length === 0 ? (
              <div className="px-2 py-2 text-[11px]" style={{ color: 'var(--ctp-overlay0)' }}>
                {t('emptyStates.noUnlinkedMentions')}
              </div>
            ) : backlinksGroupByFolder ? (
              <GroupedResults
                results={filteredUnlinked}
                accentColor="var(--ctp-yellow)"
                contextLineCount={backlinksContextLines}
                vaultPath={vaultPath}
                openFile={openFile}
                rootLabel={t('fileTree.root')}
              />
            ) : (
              filteredUnlinked.map((r) => (
                <div key={r.filePath} className="flex flex-col gap-0.5 px-2 py-1.5 text-xs rounded hover:bg-[var(--ctp-surface0)] transition-colors">
                  <button
                    className="flex items-center gap-2 w-full text-left"
                    style={{ color: 'var(--ctp-subtext1)' }}
                    onClick={(e) => { if (vaultPath) openFile(vaultPath, r.filePath, e.ctrlKey || e.metaKey); }}
                  >
                    <FileText size={12} style={{ color: 'var(--ctp-yellow)', flexShrink: 0 }} />
                    <span className="truncate font-medium">{r.fileName}</span>
                    {r.dir && (
                      <span className="truncate text-[10px] ml-auto" style={{ color: 'var(--ctp-overlay0)' }}>
                        {r.dir}
                      </span>
                    )}
                  </button>
                  <div className="pl-5 space-y-0.5">
                    {r.contextLines.slice(0, backlinksContextLines).map((line, i) => (
                      <div key={i} className="flex items-center gap-1 group">
                        <span
                          className="truncate flex-1"
                          style={{ color: 'var(--ctp-overlay1)', fontSize: '0.6875rem' }}
                        >
                          {cleanWikiLinks(line)}
                        </span>
                        <button
                          onClick={() => handleLinkMention(r.filePath, line, r.contextLineNumbers?.[i] ?? -1)}
                          className="shrink-0 rounded px-1 py-0.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--ctp-surface1)]"
                          style={{ color: 'var(--ctp-yellow)' }}
                          title={t('backlinks.link')}
                        >
                          {t('backlinks.link')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
