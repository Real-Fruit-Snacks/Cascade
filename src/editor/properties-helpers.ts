import type { PropType } from './properties-types';

// ── Helper / utility functions ───────────────────────────────

export function detectType(key: string, value: string): PropType {
  if (value === 'true' || value === 'false') return 'checkbox';
  const k = key.toLowerCase();
  if (/^\[/.test(value) || k === 'tags' || k === 'categories' || k === 'keywords' || k === 'aliases') return 'list';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'datetime';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
  if (/^-?\d+(\.\d+)?$/.test(value) && value !== '') return 'number';
  return 'text';
}

export function parseListValue(value: string): string[] {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
  }
  return value ? [value] : [];
}

export function convertValue(oldValue: string, oldType: PropType, newType: PropType): string {
  if (oldType === newType) return oldValue;
  switch (newType) {
    case 'text': {
      if (oldType === 'list') {
        const items = parseListValue(oldValue);
        return items.join(', ');
      }
      return oldValue;
    }
    case 'list': {
      if (oldValue && !oldValue.startsWith('[')) return `[${oldValue}]`;
      if (!oldValue) return '[]';
      return oldValue;
    }
    case 'number': {
      const n = parseFloat(oldValue);
      return isNaN(n) ? '0' : String(n);
    }
    case 'checkbox':
      return oldValue === 'true' ? 'true' : 'false';
    case 'date': {
      if (/^\d{4}-\d{2}-\d{2}/.test(oldValue)) return oldValue.slice(0, 10);
      return new Date().toISOString().slice(0, 10);
    }
    case 'datetime': {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(oldValue)) return oldValue.slice(0, 16);
      if (/^\d{4}-\d{2}-\d{2}$/.test(oldValue)) return `${oldValue}T00:00`;
      return new Date().toISOString().slice(0, 16);
    }
    default:
      return oldValue;
  }
}

export function serializeYaml(props: { key: string; value: string; type: PropType }[]): string {
  let yaml = '---\n';
  for (const { key, value, type } of props) {
    if (!key) continue;
    if (type === 'list') {
      const items = parseListValue(value);
      if (items.length === 0) {
        yaml += `${key}: []\n`;
      } else {
        yaml += `${key}:\n`;
        for (const item of items) {
          yaml += `  - ${item}\n`;
        }
      }
    } else {
      yaml += `${key}: ${value}\n`;
    }
  }
  yaml += '---';
  return yaml;
}
