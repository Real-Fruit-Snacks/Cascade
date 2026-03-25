import { useEffect, useState } from 'react';

interface UiFontSizeSliderProps {
  value: number;
  onCommit: (v: number) => void;
}

/** Slider that shows a live preview but only commits the value on mouse/pointer release */
export function UiFontSizeSlider({ value, onCommit }: UiFontSizeSliderProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={11}
        max={18}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={() => onCommit(draft)}
        onTouchEnd={() => onCommit(draft)}
        onKeyUp={() => onCommit(draft)}
        className="accent-[var(--ctp-accent)]"
        style={{ width: 120 }}
      />
      <span className="text-xs text-right" style={{ color: 'var(--ctp-subtext1)', width: 32 }}>
        {draft}px
      </span>
    </div>
  );
}
