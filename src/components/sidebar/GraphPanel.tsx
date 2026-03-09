import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Settings, RotateCcw, Crosshair } from 'lucide-react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { useVaultStore } from '../../stores/vault-store';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore } from '../../stores/settings-store';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  filePath: string;
  connectionCount: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: GraphNode | string;
  target: GraphNode | string;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface GraphSettings {
  repulsion: number;
  linkDistance: number;
  showOrphans: boolean;
  labelsAlways: boolean;
  nodeLimit: number;
  localMode: boolean;
  localDepth: number;
  filterIncludeFolders: string;
  filterExcludeFolders: string;
  filterIncludeTags: string;
  filterExcludeTags: string;
  colorBy: 'none' | 'folder' | 'tag';
}

function getDefaultSettings(): GraphSettings {
  const s = useSettingsStore.getState();
  return {
    repulsion: 100,
    linkDistance: s.graphLinkDistance,
    showOrphans: s.graphShowOrphans,
    labelsAlways: false,
    nodeLimit: s.graphMaxNodes,
    localMode: false,
    localDepth: 2,
    filterIncludeFolders: '',
    filterExcludeFolders: '',
    filterIncludeTags: '',
    filterExcludeTags: '',
    colorBy: 'none',
  };
}

const GRAPH_SETTINGS_KEY = 'cascade-graph-settings';

function loadGraphSettings(): GraphSettings {
  const defaults = getDefaultSettings();
  try {
    const saved = localStorage.getItem(GRAPH_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const safe: Partial<GraphSettings> = {};
      for (const key of Object.keys(defaults) as (keyof GraphSettings)[]) {
        if (key in parsed && typeof parsed[key] === typeof defaults[key]) {
          (safe as Record<string, unknown>)[key] = parsed[key];
        }
      }
      return { ...defaults, ...safe };
    }
  } catch { /* ignore */ }
  return { ...defaults };
}

function saveGraphSettings(s: GraphSettings) {
  localStorage.setItem(GRAPH_SETTINGS_KEY, JSON.stringify(s));
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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const nodeBaseSize = nodeBaseSizeRef.current;
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const colors = colorsRef.current;
    const hovered = hoveredNodeRef.current;
    const offset = offsetRef.current;
    const scale = scaleRef.current;

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Determine active and connected nodes — use selectedPath when on graph tab
    const highlightPath = activeFilePathRef.current?.startsWith('__') ? selectedPathRef.current : activeFilePathRef.current;
    const activeNode = highlightPath
      ? nodes.find((n) => n.filePath === highlightPath) ?? null
      : null;
    const connectedIds = new Set<string>();
    if (activeNode) {
      for (const link of links) {
        const s = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
        const t = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
        if (s === activeNode.id) connectedIds.add(t);
        if (t === activeNode.id) connectedIds.add(s);
      }
    }

    const hoveredIds = new Set<string>();
    if (hovered) {
      for (const link of links) {
        const s = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
        const t = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
        if (s === hovered.id) hoveredIds.add(t);
        if (t === hovered.id) hoveredIds.add(s);
      }
    }

    // Draw edges
    for (const link of links) {
      const sNode = link.source as GraphNode;
      const tNode = link.target as GraphNode;
      if (sNode.x == null || sNode.y == null || tNode.x == null || tNode.y == null) continue;

      const isHighlighted =
        (activeNode && (sNode.id === activeNode.id || tNode.id === activeNode.id)) ||
        (hovered && (sNode.id === hovered.id || tNode.id === hovered.id));

      ctx.beginPath();
      ctx.moveTo(sNode.x, sNode.y);
      ctx.lineTo(tNode.x, tNode.y);
      ctx.strokeStyle = isHighlighted
        ? colors['--ctp-overlay1'] + 'cc'
        : colors['--ctp-surface2'] + '66';
      ctx.lineWidth = isHighlighted ? 1.5 : 1;
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;

      const isActive = activeNode?.id === node.id;
      const isConnected = connectedIds.has(node.id);
      const isHovered = hovered?.id === node.id;
      const isHoveredNeighbor = hoveredIds.has(node.id);

      const radius = Math.max(nodeBaseSize - 2, Math.min(nodeBaseSize + 2, nodeBaseSize + node.connectionCount * 0.8));

      let color: string;
      if (isActive) {
        color = colors['--ctp-accent'];
      } else if (isConnected) {
        color = colors['--ctp-blue'];
      } else if (isHovered) {
        color = colors['--ctp-accent'];
      } else if (isHoveredNeighbor) {
        color = colors['--ctp-blue'];
      } else {
        const mappedVar = nodeColorMapRef.current.get(node.filePath);
        color = mappedVar ? colors[mappedVar] || colors['--ctp-overlay1'] : colors['--ctp-overlay1'];
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, isHovered || isActive ? radius + 2 : radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Label: always show for active/hovered/neighbors, show all when zoomed in
      const showLabel = isActive || isConnected || isHovered || isHoveredNeighbor || settingsRef.current.labelsAlways || scale >= 1.5;
      if (showLabel) {
        const label = node.id.replace(/\.md$/i, '');
        const fontSize = Math.max(8, Math.min(12, 10 / Math.sqrt(scale)));
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = isActive || isHovered ? colors['--ctp-subtext0'] : colors['--ctp-subtext0'] + (scale >= 2.5 ? 'ff' : 'aa');
        ctx.textAlign = 'center';
        ctx.fillText(label, node.x, node.y - radius - 4);
      }
    }

    ctx.restore();
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
      // Include nodes based on orphan setting
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
        if (!srcNode || srcNode.id === targetNode.id) continue;
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

  // Mouse interactions
  const getNodeAtPos = useCallback((canvasX: number, canvasY: number): GraphNode | null => {
    const nodes = nodesRef.current;
    const offset = offsetRef.current;
    const scale = scaleRef.current;
    // Convert canvas coords to world coords
    const wx = (canvasX - offset.x) / scale;
    const wy = (canvasY - offset.y) / scale;

    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const bs = nodeBaseSizeRef.current;
      const r = Math.max(bs - 2, Math.min(bs + 2, bs + node.connectionCount * 0.8)) + 4; // hit area
      const dx = wx - node.x;
      const dy = wy - node.y;
      if (dx * dx + dy * dy <= r * r) return node;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (isDraggingRef.current) {
      offsetRef.current = {
        x: offsetStartRef.current.x + (e.clientX - dragStartRef.current.x),
        y: offsetStartRef.current.y + (e.clientY - dragStartRef.current.y),
      };
      draw();
      return;
    }

    const node = getNodeAtPos(cx, cy);
    if (node !== hoveredNodeRef.current) {
      hoveredNodeRef.current = node;
      canvas.style.cursor = node ? 'pointer' : 'grab';
      draw();
    }
  }, [draw, getNodeAtPos]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const node = getNodeAtPos(cx, cy);

    if (!node) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      offsetStartRef.current = { ...offsetRef.current };
      canvas.style.cursor = 'grabbing';
    }
  }, [getNodeAtPos]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      canvas.style.cursor = 'grab';
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const node = getNodeAtPos(cx, cy);
    if (node && vaultPath) {
      selectedPathRef.current = node.filePath;
      openFile(vaultPath, node.filePath, true, true);
      draw();
    }
  }, [draw, getNodeAtPos, openFile, vaultPath]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(3, Math.max(0.3, scaleRef.current * zoomFactor));

    // Zoom toward mouse position
    offsetRef.current = {
      x: mouseX - (mouseX - offsetRef.current.x) * (newScale / scaleRef.current),
      y: mouseY - (mouseY - offsetRef.current.y) * (newScale / scaleRef.current),
    };
    scaleRef.current = newScale;
    draw();
  }, [draw]);

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
        <div
          className="shrink-0 px-3 py-2 flex flex-col gap-2"
          style={{
            borderBottom: '1px solid var(--ctp-surface1)',
            backgroundColor: 'var(--ctp-crust)',
            fontSize: '0.6875rem',
            color: 'var(--ctp-subtext0)',
          }}
        >
          <div className="flex items-center justify-between">
            <span>{t('settings.repulsion')}</span>
            <div className="flex items-center gap-2">
              <input
                type="range" min={30} max={300} step={10}
                value={settings.repulsion}
                onChange={(e) => updateSetting('repulsion', Number(e.target.value))}
                className="w-20 accent-[var(--ctp-accent)]"
              />
              <span className="w-6 text-right" style={{ color: 'var(--ctp-overlay1)' }}>{settings.repulsion}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('settings.linkDistance')}</span>
            <div className="flex items-center gap-2">
              <input
                type="range" min={20} max={300} step={10}
                value={settings.linkDistance}
                onChange={(e) => updateSetting('linkDistance', Number(e.target.value))}
                className="w-20 accent-[var(--ctp-accent)]"
              />
              <span className="w-6 text-right" style={{ color: 'var(--ctp-overlay1)' }}>{settings.linkDistance}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('settings.maxNodes')}</span>
            <div className="flex items-center gap-2">
              <input
                type="range" min={50} max={2000} step={50}
                value={settings.nodeLimit}
                onChange={(e) => updateSetting('nodeLimit', Number(e.target.value))}
                className="w-20 accent-[var(--ctp-accent)]"
              />
              <span className="w-6 text-right" style={{ color: 'var(--ctp-overlay1)' }}>{settings.nodeLimit}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('settings.showOrphans')}</span>
            <button
              onClick={() => updateSetting('showOrphans', !settings.showOrphans)}
              className="w-8 h-4 rounded-full transition-colors relative"
              style={{ backgroundColor: settings.showOrphans ? 'var(--ctp-accent)' : 'var(--ctp-surface2)' }}
            >
              <div
                className="absolute top-0.5 w-3 h-3 rounded-full transition-transform"
                style={{
                  backgroundColor: 'var(--ctp-crust)',
                  transform: settings.showOrphans ? 'translateX(16px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('settings.alwaysShowLabels')}</span>
            <button
              onClick={() => updateSetting('labelsAlways', !settings.labelsAlways)}
              className="w-8 h-4 rounded-full transition-colors relative"
              style={{ backgroundColor: settings.labelsAlways ? 'var(--ctp-accent)' : 'var(--ctp-surface2)' }}
            >
              <div
                className="absolute top-0.5 w-3 h-3 rounded-full transition-transform"
                style={{
                  backgroundColor: 'var(--ctp-crust)',
                  transform: settings.labelsAlways ? 'translateX(16px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('settings.localGraph')}</span>
            <button
              onClick={() => updateSetting('localMode', !settings.localMode)}
              className="w-8 h-4 rounded-full transition-colors relative"
              style={{ backgroundColor: settings.localMode ? 'var(--ctp-accent)' : 'var(--ctp-surface2)' }}
            >
              <div
                className="absolute top-0.5 w-3 h-3 rounded-full transition-transform"
                style={{
                  backgroundColor: 'var(--ctp-crust)',
                  transform: settings.localMode ? 'translateX(16px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
          {settings.localMode && (
            <div className="flex items-center justify-between">
              <span>{t('settings.depth')}</span>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={1} max={5} step={1}
                  value={settings.localDepth}
                  onChange={(e) => updateSetting('localDepth', Number(e.target.value))}
                  className="w-20 accent-[var(--ctp-accent)]"
                />
                <span className="w-6 text-right" style={{ color: 'var(--ctp-overlay1)' }}>{settings.localDepth}</span>
              </div>
            </div>
          )}
          <div className="pt-1" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ctp-overlay0)' }}>{t('filters.sectionHeader')}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span>{t('filters.includeFolders')}</span>
            <input
              type="text"
              value={settings.filterIncludeFolders}
              onChange={(e) => updateSetting('filterIncludeFolders', e.target.value)}
              placeholder={t('filters.placeholders.includeFolders')}
              className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none placeholder:text-[var(--ctp-overlay0)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>{t('filters.excludeFolders')}</span>
            <input
              type="text"
              value={settings.filterExcludeFolders}
              onChange={(e) => updateSetting('filterExcludeFolders', e.target.value)}
              placeholder={t('filters.placeholders.excludeFolders')}
              className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none placeholder:text-[var(--ctp-overlay0)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>{t('filters.includeTags')}</span>
            <input
              type="text"
              value={settings.filterIncludeTags}
              onChange={(e) => updateSetting('filterIncludeTags', e.target.value)}
              placeholder={t('filters.placeholders.includeTags')}
              className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none placeholder:text-[var(--ctp-overlay0)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>{t('filters.excludeTags')}</span>
            <input
              type="text"
              value={settings.filterExcludeTags}
              onChange={(e) => updateSetting('filterExcludeTags', e.target.value)}
              placeholder={t('filters.placeholders.excludeTags')}
              className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none placeholder:text-[var(--ctp-overlay0)]"
            />
          </div>
          <div className="pt-1" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
            <div className="flex items-center justify-between">
              <span>{t('colorBy.label')}</span>
              <select
                value={settings.colorBy}
                onChange={(e) => updateSetting('colorBy', e.target.value as 'none' | 'folder' | 'tag')}
                className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none"
              >
                <option value="none">{t('colorBy.options.none')}</option>
                <option value="folder">{t('colorBy.options.folder')}</option>
                <option value="tag">{t('colorBy.options.tag')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Canvas container */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden min-h-0">
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: 'grab' }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            isDraggingRef.current = false;
            hoveredNodeRef.current = null;
            draw();
          }}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
}
