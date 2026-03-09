import type { PropertyQuery, QueryFilter } from '../lib/tauri-commands';

export function parseQuery(code: string): PropertyQuery | null {
  const lines = code.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return null;

  const firstLine = lines[0].toUpperCase();
  let output: string;
  let fields: string[] = [];

  if (firstLine.startsWith('TABLE')) {
    output = 'TABLE';
    const rest = lines[0].slice(5).trim();
    if (rest) {
      fields = rest.split(',').map((f) => f.trim()).filter((f) => f.length > 0);
    }
  } else if (firstLine.startsWith('LIST')) {
    output = 'LIST';
  } else {
    return null;
  }

  let fromTag: string | null = null;
  let fromFolder: string | null = null;
  const filters: QueryFilter[] = [];
  let sortBy: string | null = null;
  let sortOrder: string | null = null;
  let limit: number | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (upper.startsWith('FROM')) {
      const arg = line.slice(4).trim();
      if (arg.startsWith('#')) {
        fromTag = arg.slice(1);
      } else if (arg.startsWith('"') && arg.endsWith('"')) {
        fromFolder = arg.slice(1, -1);
      }
    } else if (upper.startsWith('WHERE')) {
      const expr = line.slice(5).trim();
      const filter = parseFilter(expr);
      if (filter) filters.push(filter);
    } else if (upper.startsWith('SORT')) {
      const parts = line.slice(4).trim().split(/\s+/);
      if (parts.length >= 1 && parts[0]) {
        sortBy = parts[0];
        sortOrder = parts[1]?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      }
    } else if (upper.startsWith('LIMIT')) {
      const n = parseInt(line.slice(5).trim(), 10);
      if (!isNaN(n)) limit = n;
    }
  }

  return { output, fields, fromTag, fromFolder, filters, sortBy, sortOrder, limit };
}

function parseFilter(expr: string): QueryFilter | null {
  // Operators ordered longest-first to avoid partial matches
  const ops = ['>=', '<=', '!=', '>', '<', '=', 'contains'];
  for (const op of ops) {
    const idx = op === 'contains'
      ? expr.toLowerCase().indexOf(' contains ')
      : expr.indexOf(op);

    if (idx === -1) continue;

    const opLen = op === 'contains' ? ' contains '.length : op.length;
    const field = expr.slice(0, idx).trim();
    const rawValue = expr.slice(idx + opLen).trim();

    if (!field) continue;

    let value: string;
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      value = rawValue.slice(1, -1);
    } else {
      // Keep as string; backend can coerce numbers
      value = rawValue;
    }

    return { field, operator: op, value };
  }
  return null;
}
