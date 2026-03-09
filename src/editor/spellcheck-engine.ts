import { readCustomDictionary, writeCustomDictionary } from '../lib/tauri-commands';

/** Compact spellcheck engine with lazy-loaded dictionary */

let dictionary: Set<string> | null = null;
let dictionaryByLength: Map<number, string[]> | null = null;
let customWords: Set<string> = new Set();
let sessionIgnored: Set<string> = new Set();
let loadPromise: Promise<void> | null = null;
let vaultPath: string | null = null;

/** Load dictionary from public/dictionary-en.txt */
export async function initDictionary(vault?: string): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const resp = await fetch('/dictionary-en.txt');
      const text = await resp.text();
      const words = text.split('\n').map((w) => w.trim().toLowerCase()).filter(Boolean);
      dictionary = new Set(words);
      // Build length-bucketed index for fast suggestion lookups
      dictionaryByLength = new Map();
      for (const w of words) {
        const len = w.length;
        let bucket = dictionaryByLength.get(len);
        if (!bucket) {
          bucket = [];
          dictionaryByLength.set(len, bucket);
        }
        bucket.push(w);
      }
    } catch {
      // Fallback: empty dictionary (nothing will be marked as misspelled)
      dictionary = new Set();
    }

    // Load custom dictionary from vault
    if (vault) {
      vaultPath = vault;
      try {
        const words = await readCustomDictionary(vault);
        customWords = new Set(words.map((w) => w.toLowerCase()));
      } catch {
        customWords = new Set();
      }
    }
  })();
  return loadPromise;
}

export function isDictionaryReady(): boolean {
  return dictionary !== null;
}

export function isCorrect(word: string): boolean {
  if (!dictionary) return true; // Not loaded yet — don't flag anything
  const lower = word.toLowerCase();
  return dictionary.has(lower) || customWords.has(lower) || sessionIgnored.has(lower);
}

/** Add word to custom dictionary (persisted per-vault) */
export function addToCustomDictionary(word: string): void {
  const lower = word.toLowerCase();
  customWords.add(lower);
  if (vaultPath) {
    writeCustomDictionary(vaultPath, [...customWords]).catch((err) => {
      console.warn('Failed to persist custom dictionary:', err);
    });
  }
}

/** Ignore word for this session only */
export function ignoreWord(word: string): void {
  sessionIgnored.add(word.toLowerCase());
}

/** Reload custom dictionary from disk (call after external changes like settings UI) */
export async function reloadCustomDictionary(): Promise<void> {
  if (!vaultPath) return;
  try {
    const words = await readCustomDictionary(vaultPath);
    customWords = new Set(words.map((w) => w.toLowerCase()));
  } catch {
    // Keep existing set if reload fails
  }
}

/** Re-initialize vault path and reload custom dictionary */
export async function setVaultPath(vault: string): Promise<void> {
  vaultPath = vault;
  try {
    const words = await readCustomDictionary(vault);
    customWords = new Set(words.map((w) => w.toLowerCase()));
  } catch {
    customWords = new Set();
  }
}

/** Reset state (for testing or vault switch) */
export function resetDictionary(): void {
  dictionary = null;
  dictionaryByLength = null;
  customWords = new Set();
  sessionIgnored = new Set();
  loadPromise = null;
  vaultPath = null;
}

/**
 * Get up to `limit` spelling suggestions using Levenshtein distance.
 * Only searches words within +-2 length of the input for performance.
 */
export function getSuggestions(word: string, limit = 5): string[] {
  if (!dictionaryByLength) return [];
  const lower = word.toLowerCase();
  const len = lower.length;
  const candidates: { word: string; dist: number }[] = [];

  // Only scan words within +-2 length using bucketed index
  for (let bucketLen = Math.max(1, len - 2); bucketLen <= len + 2; bucketLen++) {
    const bucket = dictionaryByLength.get(bucketLen);
    if (!bucket) continue;
    for (const entry of bucket) {
      const d = levenshtein(lower, entry);
      if (d > 0 && d <= 2) {
        candidates.push({ word: entry, dist: d });
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, limit).map((c) => c.word);
}

/** Simple Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Use single-row optimization
  let prev = new Uint16Array(lb + 1);
  let curr = new Uint16Array(lb + 1);

  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}
