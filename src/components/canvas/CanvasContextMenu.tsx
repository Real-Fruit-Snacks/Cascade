import { Type, FileText, Link, Square, Trash2, Copy, Palette, Tag, ZoomIn } from 'lucide-react';
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
}: CanvasContextMenuProps) {
  const store = useCanvasStore.getState();

  // --- Node context menu ---
  if (targetNodeId) {
    const node = store.nodes.find((n) => n.id === targetNodeId);
    if (!node) return null;

    const colorItems = buildColorItems((code) => {
      store.updateNode(targetNodeId, { color: code });
    });

    const items: MenuItem[] = [];

    if (node.type === 'text') {
      items.push({
        label: 'Edit',
        icon: <Type size={14} />,
        onClick: () => store.setEditingNode(targetNodeId),
      });
    }

    if (node.type === 'file') {
      items.push({
        label: 'Open in Tab',
        icon: <FileText size={14} />,
        onClick: () => {
          useEditorStore.getState().openFile(vaultPath, (node as { file: string }).file, true);
        },
      });
    }

    items.push({ label: '', separator: true, onClick: () => {} });

    items.push({
      label: 'Color',
      icon: <Palette size={14} />,
      onClick: () => {},
    });
    items.push(...colorItems.map((item) => ({ ...item, label: '  ' + item.label })));

    items.push({ label: '', separator: true, onClick: () => {} });

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

    return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
  }

  // --- Edge context menu ---
  if (targetEdgeId) {
    const edge = store.edges.find((e) => e.id === targetEdgeId);
    if (!edge) return null;

    const colorItems = buildColorItems((code) => {
      store.updateEdge(targetEdgeId, { color: code });
    });

    const items: MenuItem[] = [
      {
        label: edge.label ? 'Edit Label' : 'Add Label',
        icon: <Tag size={14} />,
        onClick: () => {
          const text = prompt('Edge label:', edge.label ?? '');
          if (text !== null) {
            store.updateEdge(targetEdgeId, { label: text });
          }
        },
      },
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
  const items: MenuItem[] = [
    {
      label: 'New Text Card',
      icon: <Type size={14} />,
      onClick: () => {
        store.addNode({
          type: 'text',
          text: '',
          x: worldX - 150,
          y: worldY - 100,
          width: 300,
          height: 200,
        } as Omit<TextNode, 'id'>);
      },
    },
    {
      label: 'New Link Card',
      icon: <Link size={14} />,
      onClick: () => {
        const url = prompt('URL:');
        if (url) {
          store.addNode({
            type: 'link',
            url,
            x: worldX - 150,
            y: worldY - 60,
            width: 300,
            height: 120,
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
          x: worldX - 150,
          y: worldY - 100,
          width: 400,
          height: 300,
        } as Omit<GroupNode, 'id'>);
      },
    },
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Zoom to Fit',
      icon: <ZoomIn size={14} />,
      onClick: () => store.zoomToFit(),
    },
  ];

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
}
