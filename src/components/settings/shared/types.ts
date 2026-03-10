import type { Settings } from '../../../stores/settings-store';

export type OptionsPageProps = { settings: Settings & { update: (partial: Partial<Settings>) => void } };
