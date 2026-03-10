import type React from 'react';

type Corner = 'tl' | 'tr' | 'bl' | 'br';

interface ResizeHandlesProps {
  onResizeMouseDown: (corner: Corner, e: React.MouseEvent) => void;
}

const CORNERS: { corner: Corner; top?: number; bottom?: number; left?: number; right?: number; cursor: string }[] = [
  { corner: 'br', bottom: -4, right: -4, cursor: 'nwse-resize' },
  { corner: 'bl', bottom: -4, left: -4, cursor: 'nesw-resize' },
  { corner: 'tr', top: -4, right: -4, cursor: 'nesw-resize' },
  { corner: 'tl', top: -4, left: -4, cursor: 'nwse-resize' },
];

export function ResizeHandles({ onResizeMouseDown }: ResizeHandlesProps) {
  return (
    <>
      {CORNERS.map(({ corner, cursor, ...pos }) => (
        <div
          key={corner}
          style={{
            position: 'absolute',
            ...pos,
            width: 8,
            height: 8,
            backgroundColor: 'var(--ctp-accent)',
            borderRadius: 2,
            cursor,
            zIndex: 10,
          }}
          onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(corner, e); }}
        />
      ))}
    </>
  );
}
