import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Settings } from '../../stores/settings-store';

export interface SettingsContextValue {
  settings: Settings & {
    update: (partial: Partial<Settings>) => void;
    reset: (key: keyof Settings) => void;
    getShortcut: (id: string) => string;
  };
  searchQuery: string;
  vaultPath: string | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children, value }: { children: ReactNode; value: SettingsContextValue }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsContext must be used within SettingsProvider');
  return ctx;
}
