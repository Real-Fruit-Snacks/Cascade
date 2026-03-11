import React from 'react';
import type { SearchMatch } from '../../lib/tauri-commands';
import { parseFileParts } from '../../lib/path-utils';

export interface FileGroup {
  filePath: string;
  fileName: string;
  dir: string | null;
  matches: SearchMatch[];
}

export function highlightQuery(
  text: string,
  query: string,
  useRegex: boolean,
  caseSensitive: boolean,
): React.ReactNode {
  if (!query) return text;

  let re: RegExp;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    re = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  const deadline = performance.now() + 50; // 50ms budget per line to prevent ReDoS UI freeze
  while ((match = re.exec(text)) !== null) {
    if (performance.now() > deadline) break; // bail out if regex is too slow
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    parts.push(
      <span key={key++} style={{ color: 'var(--ctp-yellow)', fontWeight: 600 }}>
        {match[0]}
      </span>
    );
    lastIdx = match.index + match[0].length;
    if (match[0].length === 0) { re.lastIndex++; } // avoid infinite loop on zero-width match
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

export interface SearchScope {
  textQuery: string;
  tags: string[];
  paths: string[];
  properties: { key: string; value: string }[];
}

export function parseSearchScope(query: string): SearchScope {
  const tags: string[] = [];
  const paths: string[] = [];
  const properties: { key: string; value: string }[] = [];
  const textParts: string[] = [];

  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  for (const token of tokens) {
    const tagMatch = token.match(/^tag:#?(.+)$/i);
    if (tagMatch) {
      tags.push(tagMatch[1].toLowerCase());
      continue;
    }
    const pathMatch = token.match(/^path:(.+)$/i);
    if (pathMatch) {
      paths.push(pathMatch[1].toLowerCase().replace(/^"(.*)"$/, '$1'));
      continue;
    }
    const propMatch = token.match(/^property:(\w+)=(.+)$/i);
    if (propMatch) {
      properties.push({ key: propMatch[1].toLowerCase(), value: propMatch[2].replace(/^"(.*)"$/, '$1') });
      continue;
    }
    textParts.push(token);
  }

  return { textQuery: textParts.join(' '), tags, paths, properties };
}

export function filterByScope(
  matches: SearchMatch[],
  scope: SearchScope,
  tagIndex: Map<string, Set<string>>,
): SearchMatch[] {
  let filtered = matches;

  // Filter by path prefix
  if (scope.paths.length > 0) {
    filtered = filtered.filter((m) => {
      const lower = m.filePath.replace(/\\/g, '/').toLowerCase();
      return scope.paths.some((p) => lower.startsWith(p + '/') || lower.startsWith(p));
    });
  }

  // Filter by tag
  if (scope.tags.length > 0) {
    const filesByTag = new Set<string>();
    for (const tag of scope.tags) {
      for (const [indexTag, files] of tagIndex) {
        if (indexTag.toLowerCase() === tag) {
          for (const f of files) filesByTag.add(f);
        }
      }
    }
    filtered = filtered.filter((m) => filesByTag.has(m.filePath));
  }

  // Filter by property (check line content for frontmatter key=value)
  if (scope.properties.length > 0) {
    const matchingFiles = new Set<string>();
    // Group matches by file to check frontmatter
    const fileLines = new Map<string, string[]>();
    for (const m of filtered) {
      if (!fileLines.has(m.filePath)) fileLines.set(m.filePath, []);
      fileLines.get(m.filePath)!.push(m.lineText);
    }
    // For property filtering, we check all matches for that file
    for (const m of filtered) {
      if (matchingFiles.has(m.filePath)) continue;
      // Simple heuristic: check if any line in results looks like "key: value" in frontmatter
      for (const prop of scope.properties) {
        const re = new RegExp(`^${prop.key}\\s*:\\s*.*${prop.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
        if (fileLines.get(m.filePath)?.some((l) => re.test(l.trim()))) {
          matchingFiles.add(m.filePath);
        }
      }
    }
    if (matchingFiles.size > 0) {
      filtered = filtered.filter((m) => matchingFiles.has(m.filePath));
    } else {
      filtered = [];
    }
  }

  return filtered;
}

export function groupByFile(matches: SearchMatch[]): FileGroup[] {
  const map = new Map<string, SearchMatch[]>();
  for (const m of matches) {
    const existing = map.get(m.filePath);
    if (existing) existing.push(m);
    else map.set(m.filePath, [m]);
  }
  const groups: FileGroup[] = [];
  for (const [filePath, fileMatches] of map) {
    const { fileName, dir } = parseFileParts(filePath);
    groups.push({ filePath, fileName, dir, matches: fileMatches });
  }
  return groups;
}
