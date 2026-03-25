import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import { useSettingsStore } from '../../../stores/settings-store';
import { useVaultStore } from '../../../stores/vault-store';
import { readCustomDictionary, writeCustomDictionary } from '../../../lib/tauri-commands';
import { reloadCustomDictionary } from '../../../editor/spellcheck-engine';
import { createLogger } from '../../../lib/logger';

const log = createLogger('SpellcheckOptionsPage');

export function SpellcheckOptionsPage() {
  const { t: ts } = useTranslation('settings');
  const spellcheckSkipCapitalized = useSettingsStore((s) => s.spellcheckSkipCapitalized);
  const update = useSettingsStore((s) => s.update);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [dictWords, setDictWords] = useState<string[]>([]);
  const [dictLoading, setDictLoading] = useState(false);
  const [newWord, setNewWord] = useState('');

  // Load custom dictionary words
  useEffect(() => {
    if (!vaultPath) return;
    setDictLoading(true);
    readCustomDictionary(vaultPath)
      .then((words) => setDictWords(words.sort((a, b) => a.localeCompare(b))))
      .catch(() => setDictWords([]))
      .finally(() => setDictLoading(false));
  }, [vaultPath]);

  const removeWord = useCallback((word: string) => {
    if (!vaultPath) return;
    const updated = dictWords.filter((w) => w !== word);
    setDictWords(updated);
    writeCustomDictionary(vaultPath, updated)
      .then(() => reloadCustomDictionary())
      .catch((err) => log.warn('Failed to update dictionary:', err));
  }, [vaultPath, dictWords]);

  const addWord = useCallback(() => {
    if (!vaultPath || !newWord.trim()) return;
    const lower = newWord.trim().toLowerCase();
    if (dictWords.includes(lower)) { setNewWord(''); return; }
    const updated = [...dictWords, lower].sort((a, b) => a.localeCompare(b));
    setDictWords(updated);
    setNewWord('');
    writeCustomDictionary(vaultPath, updated)
      .then(() => reloadCustomDictionary())
      .catch((err) => log.warn('Failed to update dictionary:', err));
  }, [vaultPath, dictWords, newWord]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('spellcheckOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('spellcheckOptions.description')}
        </span>
      </div>
      <SettingRow label={ts('spellcheckOptions.skipCapitalized.label')} description={ts('spellcheckOptions.skipCapitalized.description')}>
        <ToggleSwitch
          checked={spellcheckSkipCapitalized}
          onChange={(v) => update({ spellcheckSkipCapitalized: v })}
        />
      </SettingRow>

      {/* Custom Dictionary Management */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('spellcheckOptions.customDictionary.title')}</span>
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {ts('spellcheckOptions.customDictionary.description')}
          </span>
        </div>

        {/* Add word input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addWord(); }}
            placeholder={ts('spellcheckOptions.customDictionary.addPlaceholder')}
            className="flex-1 text-xs rounded px-2 py-1.5"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface1)',
              outline: 'none',
            }}
          />
          <button
            onClick={addWord}
            disabled={!newWord.trim()}
            className="text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-30"
            style={{
              backgroundColor: 'var(--ctp-accent)',
              color: 'var(--ctp-base)',
            }}
          >
            {ts('spellcheckOptions.customDictionary.add')}
          </button>
        </div>

        {/* Word list */}
        <div
          className="rounded overflow-hidden"
          style={{ border: '1px solid var(--ctp-surface0)' }}
        >
          {dictLoading ? (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{ts('spellcheckOptions.customDictionary.loading')}</span>
            </div>
          ) : dictWords.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{ts('spellcheckOptions.customDictionary.noWords')}</span>
            </div>
          ) : (
            <div
              className="flex flex-col overflow-y-auto"
              style={{ maxHeight: 200 }}
            >
              {dictWords.map((word) => (
                <div
                  key={word}
                  className="flex items-center justify-between px-3 py-1.5 group transition-colors"
                  style={{ borderBottom: '1px solid var(--ctp-surface0)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--ctp-surface0)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span className="text-xs font-mono" style={{ color: 'var(--ctp-text)' }}>{word}</span>
                  <button
                    onClick={() => removeWord(word)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--ctp-red)' }}
                    title={ts('spellcheckOptions.customDictionary.removeWord', { word })}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {dictWords.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {ts('spellcheckOptions.customDictionary.wordCount', { count: dictWords.length })}
          </span>
        )}
      </div>

      <FeatureWiki featureId="spellcheck-options" />
    </div>
  );
}
