import { useRef, useState, useCallback } from 'react';
import { X, RotateCcw, Save } from 'lucide-react';
import { useThemeStudioStore } from '../../stores/theme-studio-store';
import type { FlavorColors } from '../../styles/themes/types';
import { CategoryFilter } from './CategoryFilter';
import { ColorSwatch } from './ColorSwatch';
import { ColorPickerPopover } from './ColorPickerPopover';
import { SaveThemeDialog } from './SaveThemeDialog';
import { getColorsForCategory } from './color-meta';

export function ThemeStudioToolbar() {
  const isOpen = useThemeStudioStore((s) => s.isOpen);
  const currentColors = useThemeStudioStore((s) => s.currentColors);
  const semanticColors = useThemeStudioStore((s) => s.semanticColors);
  const activeCategory = useThemeStudioStore((s) => s.activeCategory);
  const hasChanges = useThemeStudioStore((s) => s.hasChanges);
  const close = useThemeStudioStore((s) => s.close);
  const setColor = useThemeStudioStore((s) => s.setColor);
  const discardChanges = useThemeStudioStore((s) => s.discardChanges);
  const saveAs = useThemeStudioStore((s) => s.saveAs);

  const [activeSwatchKey, setActiveSwatchKey] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const swatchRefs = useRef<Map<string, HTMLElement>>(new Map());

  const setSwatchRef = useCallback((key: string, el: HTMLElement | null) => {
    if (el) {
      swatchRefs.current.set(key, el);
    } else {
      swatchRefs.current.delete(key);
    }
  }, []);

  const handleSwatchClick = useCallback((key: string) => {
    if (activeSwatchKey === key) {
      setActiveSwatchKey(null);
      setAnchorRect(null);
      return;
    }
    const el = swatchRefs.current.get(key);
    if (el) {
      setAnchorRect(el.getBoundingClientRect());
    }
    setActiveSwatchKey(key);
  }, [activeSwatchKey]);

  const handleColorSelect = useCallback((value: string) => {
    if (activeSwatchKey) {
      setColor(activeSwatchKey as keyof FlavorColors, value);
    }
  }, [activeSwatchKey, setColor]);

  const handlePopoverClose = useCallback(() => {
    setActiveSwatchKey(null);
    setAnchorRect(null);
  }, []);

  const handleSave = useCallback(async (name: string) => {
    setShowSaveDialog(false);
    await saveAs(name);
  }, [saveAs]);

  /** Get color value for any key — checks semantic colors first, then palette */
  const getColorValue = (key: string): string =>
    semanticColors[key] ?? currentColors?.[key as keyof FlavorColors] ?? '#000000';

  if (!isOpen || !currentColors) return null;

  const colorKeys = getColorsForCategory(activeCategory);

  return (
    <>
      {/* Color picker popover — rendered outside toolbar to avoid clipping */}
      {activeSwatchKey && (
        <ColorPickerPopover
          colorKey={activeSwatchKey}
          currentValue={getColorValue(activeSwatchKey)}
          anchorRect={anchorRect}
          onSelect={handleColorSelect}
          onClose={handlePopoverClose}
        />
      )}

      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Theme Studio"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          backgroundColor: 'color-mix(in srgb, var(--ctp-mantle) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--ctp-surface1)',
        }}
      >
        {/* Left: category filter */}
        <div style={{ flexShrink: 0 }}>
          <CategoryFilter />
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 32,
            backgroundColor: 'var(--ctp-surface1)',
            flexShrink: 0,
          }}
        />

        {/* Center: scrollable swatch row */}
        <div
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'visible',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingBottom: 2,
            scrollbarWidth: 'none',
          }}
        >
          {colorKeys.map((key) => (
            <div
              key={key}
              ref={(el) => setSwatchRef(key, el)}
            >
              <ColorSwatch
                colorKey={key}
                value={getColorValue(key)}
                isActive={activeSwatchKey === key}
                onClick={() => handleSwatchClick(key)}
              />
            </div>
          ))}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 32,
            backgroundColor: 'var(--ctp-surface1)',
            flexShrink: 0,
          }}
        />

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {hasChanges && (
            <button
              onClick={discardChanges}
              title="Discard changes"
              aria-label="Discard changes"
              className="flex items-center justify-center rounded p-1.5 transition-colors"
              style={{
                color: 'var(--ctp-subtext0)',
                backgroundColor: 'var(--ctp-surface1)',
              }}
            >
              <RotateCcw size={14} />
            </button>
          )}

          {/* Save As — relative container for the dialog popover */}
          <div style={{ position: 'relative' }}>
            {showSaveDialog && (
              <SaveThemeDialog
                onSave={handleSave}
                onCancel={() => setShowSaveDialog(false)}
              />
            )}
            <button
              onClick={() => setShowSaveDialog((v) => !v)}
              title="Save as new theme"
              aria-label="Save as new theme"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--ctp-accent)',
                color: 'var(--ctp-base)',
              }}
            >
              <Save size={13} />
              Save As
            </button>
          </div>

          <button
            onClick={close}
            title="Close Theme Studio"
            aria-label="Close Theme Studio"
            className="flex items-center justify-center rounded p-1.5 transition-colors"
            style={{
              color: 'var(--ctp-subtext0)',
              backgroundColor: 'var(--ctp-surface1)',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
