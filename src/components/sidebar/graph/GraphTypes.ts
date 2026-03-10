import { type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import { useSettingsStore } from '../../../stores/settings-store';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  filePath: string;
  connectionCount: number;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: GraphNode | string;
  target: GraphNode | string;
}

export interface GraphSettings {
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

export function getDefaultSettings(): GraphSettings {
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

export const GRAPH_SETTINGS_KEY = 'cascade-graph-settings';

export function loadGraphSettings(): GraphSettings {
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

export function saveGraphSettings(s: GraphSettings) {
  localStorage.setItem(GRAPH_SETTINGS_KEY, JSON.stringify(s));
}
