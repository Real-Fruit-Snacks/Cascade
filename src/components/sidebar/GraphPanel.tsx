import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Settings, RotateCcw, Crosshair } from 'lucide-react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import { useVaultStore } from '../../stores/vault-store';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore } from '../../stores/settings-store';
import {
  type GraphNode,
  type GraphLink,
  type GraphSettings,
  getDefaultSettings,
  loadGraphSettings,
  saveGraphSettings,
} from './graph/GraphTypes';
import { drawGraph } from './graph/GraphRenderer';
import {
  handleMouseMove as doMouseMove,
  handleMouseDown as doMouseDown,
  handleMouseUp as doMouseUp,
  handleWheel as doWheel,
} from './graph/GraphMouseHandlers';
import { GraphSettingsPanel } from './graph/GraphSettingsPanel';

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function GraphPanel() {
  const { t } = useTranslation('graph');
  const backlinkIndex = useVaultStore((s) => s.backlinkIndex);
  const tagIndex = useVaultStore((s) => s.tagIndex);
  const flatFiles = useVaultStore((s) => s.flatFiles);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const openFile = useEditorStore((s) => s.openFile);
  const [settings, setSettings] = useState<GraphSettings>(loadGraphSettings);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const updateSetting = useCallback(<K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveGraphSettings(next);
      // Sync relevant values back to settings store
      const storeUpdate: Record<string, unknown> = {};
      if (key === 'linkDistance') storeUpdate.graphLinkDistance = value;
      if (key === 'showOrphans') storeUpdate.graphShowOrphans = value;
      if (key === 'nodeLimit') storeUpdate.graphMaxNodes = value;
      if (Object.keys(storeUpdate).length > 0) {
        useSettingsStore.getState().update(storeUpdate);
      }
      return next;
    });
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const rafRef = useRef<number | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const selectedPathRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  const colorsRef = useRef<Record<string, string>>({});
  const nodeColorMapRef = useRef<Map<string, string>>(new Map());
  const nodeBaseSizeRef = useRef(useSettingsStore.getState().graphNodeSize ?? 6);
  const activeFilePathRef = useRef(activeFilePath);

  // Keep nodeBaseSizeRef in sync with settings store
  useEffect(() => {
    return useSettingsStore.subscribe((s) => {
      nodeBaseSizeRef.current = s.graphNodeSize;
    });
  }, []);

  useEffect(() => { activeFilePathRef.current = activeFilePath; }, [activeFilePath]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawGraph({
      canvas,
      nodes: nodesRef.current,
      links: linksRef.current,
      colors: colorsRef.current,
      hoveredNode: hoveredNodeRef.current,
      activeFilePath: activeFilePathRef.current,
      selectedPath: selectedPathRef.current,
      offset: offsetRef.current,
      scale: scaleRef.current,
      nodeBaseSize: nodeBaseSizeRef.current,
      nodeColorMap: nodeColorMapRef.current,
      settings: settingsRef.current,
    });
  }, []);

  const startRaf = useCallback(() => {
    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // In global mode, activeFilePath only affects highlight color — don't rebuild the graph for it
  const graphActiveFile = settings.localMode ? activeFilePath : null;

  // Build graph data and run simulation
  useEffect(() => {
    let mdFiles = flatFiles.filter((f) => f.toLowerCase().endsWith('.md'));

    // Apply folder/tag filters
    const { filterIncludeFolders, filterExcludeFolders, filterIncludeTags, filterExcludeTags } = settingsRef.current;
    const parseCsv = (s: string) => s.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
    const includeFolders = parseCsv(filterIncludeFolders);
    const excludeFolders = parseCsv(filterExcludeFolders);
    const includeTags = parseCsv(filterIncludeTags);
    const excludeTags = parseCsv(filterExcludeTags);

    // Build reverse tag lookup: filePath -> set of tags
    const fileTagsMap = new Map<string, Set<string>>();
    if (includeTags.length > 0 || excludeTags.length > 0) {
      for (const [tag, files] of tagIndex) {
        for (const f of files) {
          if (!fileTagsMap.has(f)) fileTagsMap.set(f, new Set());
          fileTagsMap.get(f)!.add(tag.toLowerCase());
        }
      }
    }

    if (includeFolders.length > 0) {
      mdFiles = mdFiles.filter((f) => {
        const lower = f.replace(/\\/g, '/').toLowerCase();
        return includeFolders.some((folder) => lower.startsWith(folder + '/') || lower.startsWith(folder));
      });
    }
    if (excludeFolders.length > 0) {
      mdFiles = mdFiles.filter((f) => {
        const lower = f.replace(/\\/g, '/').toLowerCase();
        return !excludeFolders.some((folder) => lower.startsWith(folder + '/') || lower.startsWith(folder));
      });
    }
    if (includeTags.length > 0) {
      mdFiles = mdFiles.filter((f) => {
        const tags = fileTagsMap.get(f);
        return tags && includeTags.some((t) => tags.has(t));
      });
    }
    if (excludeTags.length > 0) {
      mdFiles = mdFiles.filter((f) => {
        const tags = fileTagsMap.get(f);
        return !tags || !excludeTags.some((t) => tags.has(t));
      });
    }

    // Count connections per node
    const connectionCount = new Map<string, number>();

    // Build O(1) lookup: lowercase basename (no .md) -> full path
    const fileByName = new Map<string, string>();
    for (const f of mdFiles) {
      const name = f.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '').toLowerCase() ?? '';
      fileByName.set(name, f);
    }

    for (const [, sources] of backlinkIndex) {
      for (const src of sources) {
        connectionCount.set(src, (connectionCount.get(src) ?? 0) + 1);
      }
    }
    for (const target of backlinkIndex.keys()) {
      const matchedPath = fileByName.get(target.toLowerCase());
      if (matchedPath) {
        connectionCount.set(matchedPath, (connectionCount.get(matchedPath) ?? 0) + (backlinkIndex.get(target)?.size ?? 0));
      }
    }

    const { showOrphans, nodeLimit, localMode, localDepth } = settingsRef.current;

    // Build adjacency map for N-hop filtering
    const adjacency = new Map<string, Set<string>>();
    for (const [target, sources] of backlinkIndex) {
      const targetPath = fileByName.get(target.toLowerCase());
      if (!targetPath) continue;
      for (const srcPath of sources) {
        if (srcPath === targetPath) continue;
        if (!adjacency.has(srcPath)) adjacency.set(srcPath, new Set());
        if (!adjacency.has(targetPath)) adjacency.set(targetPath, new Set());
        adjacency.get(srcPath)!.add(targetPath);
        adjacency.get(targetPath)!.add(srcPath);
      }
    }

    let nodeFileSet: Set<string>;

    if (localMode && activeFilePath && !activeFilePath.startsWith('__')) {
      // Local graph: BFS from active file up to N hops
      const visited = new Set<string>();
      let frontier = new Set<string>([activeFilePath]);
      visited.add(activeFilePath);
      for (let hop = 0; hop < localDepth && frontier.size > 0; hop++) {
        const nextFrontier = new Set<string>();
        for (const node of frontier) {
          const neighbors = adjacency.get(node);
          if (!neighbors) continue;
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              nextFrontier.add(neighbor);
            }
          }
        }
        frontier = nextFrontier;
      }
      nodeFileSet = visited;
    } else {
      // Global graph
      const eligibleFiles = showOrphans
        ? mdFiles.slice(0, nodeLimit)
        : mdFiles.filter((f) => (connectionCount.get(f) ?? 0) >= 1).slice(0, nodeLimit);

      // Also include files that are linked TO (targets)
      const targetFileSet = new Set<string>();
      for (const [target] of backlinkIndex) {
        const matchedPath = fileByName.get(target.toLowerCase());
        if (matchedPath) targetFileSet.add(matchedPath);
      }

      nodeFileSet = new Set([...eligibleFiles, ...targetFileSet].slice(0, nodeLimit));
    }

    const nodes: GraphNode[] = Array.from(nodeFileSet).map((filePath) => ({
      id: filePath.replace(/\\/g, '/').split('/').pop() ?? filePath,
      filePath,
      connectionCount: connectionCount.get(filePath) ?? 0,
    }));

    const nodeByPath = new Map(nodes.map((n) => [n.filePath, n]));

    // Build links from backlinkIndex
    const links: GraphLink[] = [];
    for (const [target, sources] of backlinkIndex) {
      const targetNode = nodes.find((n) => {
        const name = n.id.replace(/\.md$/i, '').toLowerCase();
        return name === target.toLowerCase();
      });
      if (!targetNode) continue;

      for (const srcPath of sources) {
        const srcNode = nodeByPath.get(srcPath);
        if (!srcNode || srcNode.filePath === targetNode.filePath) continue;
        links.push({ source: srcNode.id, target: targetNode.id });
      }
    }

    // Build color map based on colorBy setting
    const COLOR_PALETTE = [
      '--ctp-red', '--ctp-blue', '--ctp-green', '--ctp-yellow', '--ctp-mauve',
      '--ctp-teal', '--ctp-peach', '--ctp-pink', '--ctp-sky', '--ctp-lavender',
      '--ctp-flamingo', '--ctp-rosewater', '--ctp-maroon', '--ctp-sapphire',
    ];
    const { colorBy } = settingsRef.current;
    const nodeColorMap = new Map<string, string>();
    if (colorBy !== 'none') {
      const groupMap = new Map<string, string[]>();
      for (const node of nodes) {
        let groupKey = '';
        if (colorBy === 'folder') {
          const parts = node.filePath.replace(/\\/g, '/').split('/');
          groupKey = parts.length > 1 ? parts[0] : '(root)';
        } else if (colorBy === 'tag') {
          const tags = fileTagsMap.get(node.filePath);
          groupKey = tags ? Array.from(tags)[0] ?? '(no tag)' : '(no tag)';
        }
        if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
        groupMap.get(groupKey)!.push(node.filePath);
      }
      let colorIdx = 0;
      for (const [, files] of groupMap) {
        const varName = COLOR_PALETTE[colorIdx % COLOR_PALETTE.length];
        for (const f of files) nodeColorMap.set(f, varName);
        colorIdx++;
      }
    }
    nodeColorMapRef.current = nodeColorMap;

    nodesRef.current = nodes;
    linksRef.current = links;

    // Cancel existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    if (nodes.length === 0) {
      draw();
      return;
    }

    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / (2 * scaleRef.current) - offsetRef.current.x / scaleRef.current : 300;
    const cy = canvas ? canvas.height / (2 * scaleRef.current) - offsetRef.current.y / scaleRef.current : 300;

    const { repulsion, linkDistance } = settingsRef.current;
    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(linkDistance))
      .force('charge', forceManyBody().strength(-repulsion))
      .force('center', forceCenter(cx, cy))
      .force('collide', forceCollide(15));

    simulationRef.current = sim;
    startRaf();

    sim.on('end', () => {
      // Keep drawing after settling, just cancel the RAF on unmount
    });

    // Stop simulation when alpha is very low
    sim.on('tick', () => {
      if (sim.alpha() < 0.01) {
        sim.stop();
        stopRaf();
        draw();
      }
    });

    return () => {
      sim.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backlinkIndex, tagIndex, flatFiles, graphActiveFile, settings.localMode, settings.localDepth, settings.filterIncludeFolders, settings.filterExcludeFolders, settings.filterIncludeTags, settings.filterExcludeTags, settings.colorBy]);

  // Sync settings store → local graph state when changed via settings modal
  const storeGraphLinkDistance = useSettingsStore((s) => s.graphLinkDistance);
  const storeGraphShowOrphans = useSettingsStore((s) => s.graphShowOrphans);
  const storeGraphMaxNodes = useSettingsStore((s) => s.graphMaxNodes);
  useEffect(() => {
    setSettings((prev) => {
      const next = {
        ...prev,
        linkDistance: storeGraphLinkDistance,
        showOrphans: storeGraphShowOrphans,
        nodeLimit: storeGraphMaxNodes,
      };
      saveGraphSettings(next);
      return next;
    });
  }, [storeGraphLinkDistance, storeGraphShowOrphans, storeGraphMaxNodes]);

  // Cache CSS vars (re-read when theme changes)
  const theme = useSettingsStore((s) => s.theme);
  useEffect(() => {
    colorsRef.current = {
      '--ctp-accent': getCssVar('--ctp-accent'),
      '--ctp-blue': getCssVar('--ctp-blue'),
      '--ctp-overlay1': getCssVar('--ctp-overlay1'),
      '--ctp-surface2': getCssVar('--ctp-surface2'),
      '--ctp-subtext0': getCssVar('--ctp-subtext0'),
    };
  }, [theme]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        draw();
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Redraw when active file changes
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilePath]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      stopRaf();
    };
  }, [stopRaf]);

  const mouseRefs = {
    canvasRef,
    nodesRef,
    nodeBaseSizeRef,
    offsetRef,
    scaleRef,
    hoveredNodeRef,
    isDraggingRef,
    dragStartRef,
    offsetStartRef,
    selectedPathRef,
  };

  const nodeCount = nodesRef.current.length;

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ backgroundColor: 'var(--ctp-mantle)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 shrink-0"
        style={{
          height: 36,
          borderBottom: '1px solid var(--ctp-surface1)',
          color: 'var(--ctp-subtext1)',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}
      >
        <Share2 size={14} strokeWidth={1.5} style={{ color: 'var(--ctp-accent)' }} />
        <span>{t('title')}</span>
        <span style={{ color: 'var(--ctp-overlay1)', marginLeft: 'auto', fontSize: '0.6875rem', marginRight: 8 }}>
          {t('nodeCount', { count: nodeCount })}
        </span>
        <button
          onClick={() => updateSetting('localMode', !settings.localMode)}
          className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ color: settings.localMode ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)' }}
          title={settings.localMode ? t('buttons.switchToGlobal') : t('buttons.switchToLocal')}
        >
          <Crosshair size={13} />
        </button>
        <button
          onClick={() => {
            const defaults = getDefaultSettings();
            setSettings({ ...defaults });
            saveGraphSettings(defaults);
            offsetRef.current = { x: 0, y: 0 };
            scaleRef.current = 1;
          }}
          className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ color: 'var(--ctp-overlay1)' }}
          title={t('buttons.resetView')}
        >
          <RotateCcw size={13} />
        </button>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ color: showSettings ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)' }}
          title={t('buttons.graphSettings')}
        >
          <Settings size={13} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <GraphSettingsPanel settings={settings} updateSetting={updateSetting} />
      )}

      {/* Canvas container */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden min-h-0">
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: 'grab' }}
          onMouseMove={(e) => doMouseMove(e, mouseRefs, draw)}
          onMouseDown={(e) => doMouseDown(e, mouseRefs)}
          onMouseUp={(e) => doMouseUp(e, mouseRefs, draw, vaultPath, openFile)}
          onMouseLeave={() => {
            isDraggingRef.current = false;
            hoveredNodeRef.current = null;
            draw();
          }}
          onWheel={(e) => doWheel(e, mouseRefs, draw)}
        />
      </div>
    </div>
  );
}
