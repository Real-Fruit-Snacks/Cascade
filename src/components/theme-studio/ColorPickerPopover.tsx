import { useEffect, useRef, useState } from 'react';
import { flavors } from '../../styles/themes/index';
import type { FlavorColors } from '../../styles/themes/types';
import { useThemeStudioStore } from '../../stores/theme-studio-store';
import { COLOR_META } from './color-meta';

interface ColorPickerPopoverProps {
  colorKey: string;
  currentValue: string;
  anchorRect: DOMRect | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

const CATPPUCCIN_FLAVOR_IDS: Array<{ id: string; label: string }> = [
  { id: 'mocha', label: 'Mocha' },
  { id: 'macchiato', label: 'Macchiato' },
  { id: 'frappe', label: 'Frappé' },
  { id: 'latte', label: 'Latte' },
];

function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Quick-pick palette colors shown at the top of every popover */
const QUICK_PICK_KEYS = [
  'rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon',
  'peach', 'yellow', 'green', 'teal', 'sky', 'sapphire', 'blue', 'lavender',
  'text', 'subtext1', 'subtext0', 'overlay2', 'overlay1', 'overlay0',
];

/** Maps semantic editor keys to the palette key they derive from */
const SEMANTIC_TO_PALETTE: Record<string, string> = {
  h1: 'red',
  h2: 'peach',
  h3: 'yellow',
  h4: 'green',
  h5: 'blue',
  h6: 'mauve',
  link: 'blue',
  bold: 'peach',
  italic: 'pink',
  code: 'green',
  'tag-color': 'blue',
  blockquote: 'overlay2',
  'list-marker': 'yellow',
};

export function ColorPickerPopover({
  colorKey,
  currentValue,
  anchorRect,
  onSelect,
  onClose,
}: ColorPickerPopoverProps) {
  const meta = COLOR_META[colorKey];
  const popoverRef = useRef<HTMLDivElement>(null);
  const [hexInput, setHexInput] = useState(currentValue);

  // Sync hex input when currentValue changes externally
  useEffect(() => {
    setHexInput(currentValue);
  }, [currentValue]);

  // Dismiss on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Dismiss on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const currentColors = useThemeStudioStore((s) => s.currentColors);

  if (!anchorRect) return null;

  // Position: above the anchor, centered horizontally, clamped to viewport
  const POPOVER_WIDTH = 280;
  const bottomOffset = window.innerHeight - anchorRect.top + 8;
  let left = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2;
  const MARGIN = 8;
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - POPOVER_WIDTH - MARGIN));

  function handleHexInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setHexInput(val);
    if (isValidHex(val)) {
      onSelect(val);
    }
  }

  function handleHexInputBlur() {
    if (!isValidHex(hexInput)) {
      setHexInput(currentValue);
    }
  }

  function handleNativeColorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setHexInput(val);
    onSelect(val);
  }

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        bottom: bottomOffset,
        left,
        width: POPOVER_WIDTH,
        zIndex: 9999,
        background: 'var(--ctp-mantle)',
        border: '1px solid var(--ctp-surface1)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header */}
      {meta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ctp-text)',
              lineHeight: 1.2,
            }}
          >
            {meta.label}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--ctp-subtext0)',
              lineHeight: 1.3,
            }}
          >
            {meta.description}
          </span>
        </div>
      )}

      {/* Quick-pick from current palette */}
      {currentColors && (
        <div>
          <span style={{ fontSize: 9, color: 'var(--ctp-overlay0)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Quick Pick
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
            {QUICK_PICK_KEYS.map((key) => {
              const val = currentColors[key as keyof FlavorColors];
              if (!val) return null;
              const isSelected = val.toLowerCase() === currentValue.toLowerCase();
              return (
                <button
                  key={key}
                  onClick={() => { setHexInput(val); onSelect(val); }}
                  title={key}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: val,
                    border: isSelected ? '2px solid var(--ctp-text)' : '1px solid var(--ctp-surface2)',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--ctp-surface1)' }} />

      {/* Catppuccin preset swatches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {CATPPUCCIN_FLAVOR_IDS.map(({ id, label }) => {
          const flavorColors = flavors[id];
          if (!flavorColors) return null;
          const lookupKey = SEMANTIC_TO_PALETTE[colorKey] ?? colorKey;
          const presetValue = flavorColors[lookupKey as keyof typeof flavorColors];
          if (!presetValue) return null;
          const isSelected = presetValue === currentValue;
          return (
            <button
              key={id}
              onClick={() => {
                setHexInput(presetValue);
                onSelect(presetValue);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 6px',
                borderRadius: 6,
                border: isSelected
                  ? '1px solid var(--ctp-accent)'
                  : '1px solid var(--ctp-surface1)',
                background: isSelected ? 'var(--ctp-surface0)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  backgroundColor: presetValue,
                  border: '1px solid var(--ctp-surface2)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--ctp-subtext1)', flex: 1, textAlign: 'left' }}>
                {label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ctp-overlay1)', fontFamily: 'monospace' }}>
                {presetValue}
              </span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--ctp-surface1)' }} />

      {/* Custom color row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={isValidHex(hexInput) ? hexInput : currentValue}
          onChange={handleNativeColorChange}
          style={{
            width: 32,
            height: 32,
            padding: 0,
            border: '1px solid var(--ctp-surface1)',
            borderRadius: 6,
            background: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Pick custom color"
        />
        <input
          type="text"
          className="ctp-input"
          value={hexInput}
          onChange={handleHexInputChange}
          onBlur={handleHexInputBlur}
          maxLength={7}
          spellCheck={false}
          aria-label="Hex color value"
          style={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: 13,
          }}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
