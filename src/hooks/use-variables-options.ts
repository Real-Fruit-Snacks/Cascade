import { useSettingsStore } from '../stores/settings-store';

export function getVariablesOptions() {
  const s = useSettingsStore.getState();
  return {
    openDelimiter: s.variablesOpenDelimiter,
    closeDelimiter: s.variablesCloseDelimiter,
    defaultSeparator: s.variablesDefaultSeparator,
    missingValueText: s.variablesMissingText,
    supportNesting: s.variablesSupportNesting,
    caseInsensitive: s.variablesCaseInsensitive,
    arrayJoinSeparator: s.variablesArrayJoinSeparator,
    preserveOnMissing: s.variablesPreserveOnMissing,
  };
}
