import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settings-store';

export function useThemeSetup(): void {
  const accentColor = useSettingsStore((s) => s.accentColor);
  const uiFontSize = useSettingsStore((s) => s.uiFontSize);

  // Apply accent color as CSS custom property
  useEffect(() => {
    document.documentElement.style.setProperty('--ctp-accent', `var(--ctp-${accentColor})`);
  }, [accentColor]);

  // Apply UI font size
  useEffect(() => {
    document.documentElement.style.fontSize = uiFontSize + 'px';
    return () => { document.documentElement.style.fontSize = ''; };
  }, [uiFontSize]);
}
