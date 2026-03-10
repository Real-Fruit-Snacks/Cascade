import { Type, FileText, Link, Square, Trash2, Copy, Palette, Tag, ZoomIn, XCircle, ArrowUpToLine, ArrowDownToLine, Code, ArrowRight, ArrowLeftRight, Minus, MoveRight, MoveLeft, AlignLeft, AlignCenterHorizontal, AlignRight as AlignRightIcon, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Lock, Unlock, Download, LayoutGrid, GitBranch, Waypoints } from 'lucide-react';
import { downloadExport } from './CanvasExport';
import { gridLayout, treeLayout, forceLayout } from './CanvasAutoLayout';
import { fitNodeToContent } from './canvas-fit-to-content';
import { useSettingsStore } from '../../stores/settings-store';
import { ContextMenu } from '../sidebar/ContextMenu';
import type { MenuItem } from '../sidebar/ContextMenu';
import { useCanvasStore } from '../../stores/canvas-store';
import { useEditorStore } from '../../stores/editor-store';
import { CANVAS_COLORS } from '../../types/canvas';
import type { CanvasColor, TextNode, LinkNode, GroupNode } from '../../types/canvas';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  targetNodeId?: string;
  targetEdgeId?: string;
  worldX: number;
  worldY: number;
  vaultPath: string;
  onClose: () => void;
  requestInput: (title: string, defaultValue?: string) => Promise<string | null>;
}

const COLOR_LABELS: Record<CanvasColor, string> = {
  '0': 'No Color',
  '1': 'Red',
  '2': 'Orange',
  '3': 'Yellow',
  '4': 'Green',
  '5': 'Teal',
  '6': 'Purple',
};

function ColorDot({ colorCode }: { colorCode: CanvasColor }) {
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: CANVAS_COLORS[colorCode],
        border: colorCode === '0' ? '1px solid var(--ctp-surface2)' : undefined,
      }}
    />
  );
}

function buildColorItems(onColor: (code: CanvasColor) => void): MenuItem[] {
  const codes: CanvasColor[] = ['0', '1', '2', '3', '4', '5', '6'];
  return codes.map((code) => ({
    label: COLOR_LABELS[code],
    icon: <ColorDot colorCode={code} />,
    onClick: () => onColor(code),
  }));
}

export function CanvasContextMenu({
  x,
  y,
  targetNodeId,
  targetEdgeId,
  worldX,
  worldY,
  vaultPath,
  onClose,
  requestInput,
}: CanvasContextMenuProps) {
  const store = useCanvasStore.getState();
  const locked = store.canvasLocked;
  const settings = useSettingsStore.getState();
  const defaultW = settings.canvasDefaultCardWidth || 260;
  const defaultH = settings.canvasDefaultCardHeight || 140;

  // --- Node context menu ---
  if (targetNodeId) {
    const node = store.nodes.find((n) => n.id === targetNodeId);
    if (!node) return null;

    const items: MenuItem[] = [];

    // Read-only actions always available
    if (node.type === 'file') {
      items.push({
        label: 'Open in Tab',
        icon: <FileText size={14} />,
        onClick: () => {
          useEditorStore.getState().openFile(vaultPath, (node as { file: string }).file, true);
        },
      });
    }

    // Auto-fit height (works in locked or unlocked) — only for CM6 cards
    if (node.type === 'text' || node.type === 'file') {
      items.push({
        label: 'Fit to Content',
        icon: <ZoomIn size={14} />,
        onClick: () => fitNodeToContent(targetNodeId, node.type === 'file' ? 80 : 60),
      });
    }

    // Mutation actions only when unlocked
    if (!locked) {
      if (node.type === 'text') {
        items.push({
          label: 'Edit',
          icon: <Type size={14} />,
          onClick: () => store.setEditingNode(targetNodeId),
        });
      }

      const colorItems = buildColorItems((code) => {
        store.updateNode(targetNodeId, { color: code });
      });

      items.push({ label: '', separator: true, onClick: () => {} });

      items.push({
        label: 'Color',
        icon: <Palette size={14} />,
        onClick: () => {},
      });
      items.push(...colorItems.map((item) => ({ ...item, label: '  ' + item.label })));

      items.push({ label: '', separator: true, onClick: () => {} });

      items.push({
        label: 'Bring to Front',
        icon: <ArrowUpToLine size={14} />,
        onClick: () => store.bringToFront(targetNodeId),
      });
      items.push({
        label: 'Send to Back',
        icon: <ArrowDownToLine size={14} />,
        onClick: () => store.sendToBack(targetNodeId),
      });

      items.push({ label: '', separator: true, onClick: () => {} });

      items.push({
        label: node.locked ? 'Unlock' : 'Lock',
        icon: node.locked ? <Unlock size={14} /> : <Lock size={14} />,
        onClick: () => store.toggleLock([targetNodeId]),
      });

      items.push({
        label: 'Duplicate',
        icon: <Copy size={14} />,
        onClick: () => {
          const { id: _id, ...rest } = node;
          store.addNode({ ...rest, x: node.x + 20, y: node.y + 20 });
        },
      });

      items.push({
        label: 'Delete',
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => store.removeNodes([targetNodeId]),
      });
    }

    // If locked and no items (non-file node), show nothing useful — just close
    if (items.length === 0) {
      onClose();
      return null;
    }

    return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
  }

  // --- Edge context menu ---
  if (targetEdgeId) {
    // When locked, no edge mutations allowed
    if (locked) {
      onClose();
      return null;
    }
    const edge = store.edges.find((e) => e.id === targetEdgeId);
    if (!edge) return null;

    const colorItems = buildColorItems((code) => {
      store.updateEdge(targetEdgeId, { color: code });
    });

    const arrowItems: MenuItem[] = [
      {
        label: '  Both Ends',
        icon: <ArrowLeftRight size={14} />,
        onClick: () => store.updateEdge(targetEdgeId, { fromEnd: 'arrow', toEnd: 'arrow' }),
      },
      {
        label: '  Start Only',
        icon: <MoveLeft size={14} />,
        onClick: () => store.updateEdge(targetEdgeId, { fromEnd: 'arrow', toEnd: 'none' }),
      },
      {
        label: '  End Only',
        icon: <MoveRight size={14} />,
        onClick: () => store.updateEdge(targetEdgeId, { fromEnd: 'none', toEnd: 'arrow' }),
      },
      {
        label: '  No Arrows',
        icon: <Minus size={14} />,
        onClick: () => store.updateEdge(targetEdgeId, { fromEnd: 'none', toEnd: 'none' }),
      },
    ];

    const lineStyleItems: MenuItem[] = [
      {
        label: '  Solid',
        icon: <Minus size={14} />,
        onClick: () => store.updateEdge(targetEdgeId, { lineStyle: 'solid' }),
      },
      {
        label: '  Dashed',
        icon: <Minus size={14} />,
        onClick: () => store.updateEdge(targetEdgeId, { lineStyle: 'dashed' }),
      },
      {
        label: '  Dotted',
        icon: <Minus size={14} />,
        onClick: () => store.updateEdge(targetEdgeId, { lineStyle: 'dotted' }),
      },
    ];

    const items: MenuItem[] = [
      {
        label: edge.label ? 'Edit Label' : 'Add Label',
        icon: <Tag size={14} />,
        onClick: async () => {
          const text = await requestInput('Edge label:', edge.label ?? '');
          if (text !== null) {
            store.updateEdge(targetEdgeId, { label: text });
          }
        },
      },
      { label: '', separator: true, onClick: () => {} },
      {
        label: 'Arrow',
        icon: <ArrowRight size={14} />,
        onClick: () => {},
      },
      ...arrowItems,
      { label: '', separator: true, onClick: () => {} },
      {
        label: 'Line Style',
        icon: <Minus size={14} />,
        onClick: () => {},
      },
      ...lineStyleItems,
      { label: '', separator: true, onClick: () => {} },
      {
        label: 'Color',
        icon: <Palette size={14} />,
        onClick: () => {},
      },
      ...colorItems.map((item) => ({ ...item, label: '  ' + item.label })),
      { label: '', separator: true, onClick: () => {} },
      {
        label: 'Delete',
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => store.removeEdges([targetEdgeId]),
      },
    ];

    return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
  }

  // --- Canvas (empty area) context menu ---
  const items: MenuItem[] = [];

  // Mutation items only when unlocked
  if (!locked) {
    items.push(
      {
        label: 'New Text Card',
        icon: <Type size={14} />,
        onClick: () => {
          store.addNode({
            type: 'text',
            text: '',
            x: worldX - defaultW / 2,
            y: worldY - defaultH / 2,
            width: defaultW,
            height: defaultH,
          } as Omit<TextNode, 'id'>);
        },
      },
      {
        label: 'New Code Block',
        icon: <Code size={14} />,
        onClick: () => {
          store.addNode({
            type: 'text',
            text: '```\n\n```',
            x: worldX - defaultW / 2,
            y: worldY - defaultH / 2,
            width: defaultW,
            height: defaultH,
          } as Omit<TextNode, 'id'>);
        },
      },
      {
        label: 'New Link Card',
        icon: <Link size={14} />,
        onClick: async () => {
          const url = await requestInput('URL:');
          if (url) {
            store.addNode({
              type: 'link',
              url,
              x: worldX - defaultW / 2,
              y: worldY - 50,
              width: defaultW,
              height: 100,
            } as Omit<LinkNode, 'id'>);
          }
        },
      },
      {
        label: 'New Group',
        icon: <Square size={14} />,
        onClick: () => {
          store.addNode({
            type: 'group',
            x: worldX - 200,
            y: worldY - 150,
            width: 400,
            height: 300,
          } as Omit<GroupNode, 'id'>);
        },
      },
      { label: '', separator: true, onClick: () => {} },
    );
  }

  items.push(
    {
      label: 'Zoom to Fit',
      icon: <ZoomIn size={14} />,
      onClick: () => store.zoomToFit(),
    },
  );

  if (!locked) {
    items.push(
      { label: '', separator: true, onClick: () => {} },
      {
        label: 'Auto Layout',
        icon: <LayoutGrid size={14} />,
        onClick: () => {},
      },
      {
        label: '  Grid',
        icon: <LayoutGrid size={14} />,
        onClick: () => {
          store.applyLayout((nodes) => gridLayout(nodes));
          store.zoomToFit();
        },
      },
      {
        label: '  Tree',
        icon: <GitBranch size={14} />,
        onClick: () => {
          store.applyLayout((nodes, edges) => treeLayout(nodes, edges));
          store.zoomToFit();
        },
      },
      {
        label: '  Force-Directed',
        icon: <Waypoints size={14} />,
        onClick: () => {
          store.applyLayout((nodes, edges) => forceLayout(nodes, edges));
          store.zoomToFit();
        },
      },
    );
  }

  items.push(
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Export',
      icon: <Download size={14} />,
      onClick: () => {},
    },
    {
      label: '  Export as PNG',
      icon: <Download size={14} />,
      onClick: () => downloadExport('png'),
    },
    {
      label: '  Export as SVG',
      icon: <Download size={14} />,
      onClick: () => downloadExport('svg'),
    },
  );

  // Add alignment/distribution items when multiple nodes are selected (unlocked only)
  if (!locked && store.selectedNodeIds.size > 1) {
    items.push({ label: '', separator: true, onClick: () => {} });
    items.push({
      label: 'Align',
      icon: <AlignLeft size={14} />,
      onClick: () => {},
    });
    items.push({
      label: '  Align Left',
      icon: <AlignLeft size={14} />,
      onClick: () => store.alignNodes('left'),
    });
    items.push({
      label: '  Align Center',
      icon: <AlignCenterHorizontal size={14} />,
      onClick: () => store.alignNodes('center'),
    });
    items.push({
      label: '  Align Right',
      icon: <AlignRightIcon size={14} />,
      onClick: () => store.alignNodes('right'),
    });
    items.push({
      label: '  Align Top',
      icon: <AlignStartVertical size={14} />,
      onClick: () => store.alignNodes('top'),
    });
    items.push({
      label: '  Align Middle',
      icon: <AlignCenterVertical size={14} />,
      onClick: () => store.alignNodes('middle'),
    });
    items.push({
      label: '  Align Bottom',
      icon: <AlignEndVertical size={14} />,
      onClick: () => store.alignNodes('bottom'),
    });
    items.push({ label: '', separator: true, onClick: () => {} });
    items.push({
      label: 'Distribute',
      icon: <AlignHorizontalDistributeCenter size={14} />,
      onClick: () => {},
    });
    items.push({
      label: '  Distribute Horizontally',
      icon: <AlignHorizontalDistributeCenter size={14} />,
      onClick: () => store.distributeNodes('horizontal'),
    });
    items.push({
      label: '  Distribute Vertically',
      icon: <AlignVerticalDistributeCenter size={14} />,
      onClick: () => store.distributeNodes('vertical'),
    });
  }

  if (!locked) {
    items.push({ label: '', separator: true, onClick: () => {} });
    items.push({
      label: 'Clear All',
      icon: <XCircle size={14} />,
      danger: true,
      onClick: () => {
        const count = store.nodes.length + store.edges.length;
        if (count === 0) return;
        const confirmed = window.confirm(
          `Delete all ${store.nodes.length} card${store.nodes.length !== 1 ? 's' : ''}${store.edges.length > 0 ? ` and ${store.edges.length} connection${store.edges.length !== 1 ? 's' : ''}` : ''}? This cannot be undone.`,
        );
        if (!confirmed) return;
        const filePath = store.filePath;
        store.clearCanvas();
        // Re-set filePath so auto-save writes the empty canvas
        if (filePath) {
          store.loadCanvas(filePath, { nodes: [], edges: [] });
        }
      },
    });
  }

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
}
