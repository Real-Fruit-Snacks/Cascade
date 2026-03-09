const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getISOWeek(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
}

function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function formatDateCustom(date: Date, format: string): string {
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(2);
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const ddd = WEEKDAYS_SHORT[date.getDay()];
  const dddd = WEEKDAYS_LONG[date.getDay()];
  const HH = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const MMM = MONTHS_SHORT[date.getMonth()];
  const MMMM = MONTHS_LONG[date.getMonth()];
  const WW = String(getISOWeek(date)).padStart(2, '0');
  const Q = String(getQuarter(date));

  // Extract [literal] bracketed text and replace with placeholders
  const literals: string[] = [];
  let processed = format.replace(/\[([^\]]*)\]/g, (_m, content: string) => {
    literals.push(content);
    return `@@LIT${literals.length - 1}@@`;
  });

  processed = processed
    .replace(/MMMM/g, MMMM)
    .replace(/MMM/g, MMM)
    .replace(/YYYY/g, yyyy)
    .replace(/YY/g, yy)
    .replace(/MM/g, MM)
    .replace(/dddd/g, dddd)
    .replace(/ddd/g, ddd)
    .replace(/DD/g, dd)
    .replace(/HH/g, HH)
    .replace(/mm/g, min)
    .replace(/ss/g, ss)
    .replace(/WW/g, WW)
    .replace(/Q/g, Q);

  // Restore literals
  return processed.replace(/@@LIT(\d+)@@/g, (_m, idx: string) => literals[Number(idx)]);
}

export interface TemplateResult {
  text: string;
  cursorOffset: number | null;
}

/**
 * Resolve {{include:path}} directives by reading referenced templates.
 * Supports up to 5 levels of nesting to prevent infinite recursion.
 */
export async function resolveTemplateIncludes(
  content: string,
  readFn: (path: string) => Promise<string>,
  depth = 0,
): Promise<string> {
  if (depth > 5) return content;
  const INCLUDE_RE = /\{\{include:([^}]+)\}\}/gi;
  let result = content;
  let match: RegExpExecArray | null;
  // Collect all includes first to avoid regex state issues
  const includes: { full: string; path: string }[] = [];
  while ((match = INCLUDE_RE.exec(content)) !== null) {
    includes.push({ full: match[0], path: match[1].trim() });
  }
  for (const inc of includes) {
    try {
      let partial = await readFn(inc.path);
      partial = await resolveTemplateIncludes(partial, readFn, depth + 1);
      result = result.replace(inc.full, partial);
    } catch {
      result = result.replace(inc.full, `[Template not found: ${inc.path}]`);
    }
  }
  return result;
}

/** Apply template variable substitution to content. */
export async function applyTemplateVariables(content: string, fileName: string, clipboard?: string): Promise<TemplateResult> {
  const now = new Date();
  const title = fileName.replace(/^.*\//, '').replace(/\.md$/i, '');
  // folder: the directory portion of the path (empty string if at vault root)
  const folder = fileName.includes('/') ? fileName.replace(/\/[^/]+$/, '') : '';

  // Pre-read clipboard if not provided and {{clipboard}} is present
  let resolvedClipboard = clipboard;
  if (resolvedClipboard === undefined && /\{\{clipboard\}\}/i.test(content)) {
    try { resolvedClipboard = await navigator.clipboard.readText(); } catch { resolvedClipboard = ''; }
  }

  let result = content
    .replace(/\{\{title\}\}/gi, title)
    .replace(/\{\{date\}\}/gi, now.toISOString().slice(0, 10))
    .replace(/\{\{time\}\}/gi, now.toTimeString().slice(0, 5))
    .replace(/\{\{datetime\}\}/gi, now.toISOString().slice(0, 16).replace('T', ' '))
    .replace(/\{\{clipboard\}\}/gi, resolvedClipboard ?? '')
    .replace(/\{\{date:([^}]+)\}\}/gi, (_, fmt) => formatDateCustom(now, fmt))
    .replace(/\{\{folder\}\}/gi, folder)
    .replace(/\{\{uuid\}\}/gi, () => crypto.randomUUID());

  // {{vault}} — vault name derived from the last segment of the vaultPath (resolved at call time)
  if (/\{\{vault\}\}/i.test(result)) {
    const { useVaultStore } = await import('../stores/vault-store');
    const vaultPath = useVaultStore.getState().vaultPath ?? '';
    const vaultName = vaultPath.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() ?? '';
    result = result.replace(/\{\{vault\}\}/gi, vaultName);
  }

  // {{plugin:funcName}} — invoke registered plugin template functions
  const pluginRe = /\{\{plugin:([^}]+)\}\}/gi;
  if (pluginRe.test(result)) {
    const { usePluginStore } = await import('../stores/plugin-store');
    const templateFunctions = usePluginStore.getState().templateFunctions;
    // Reset regex lastIndex after the .test() call
    pluginRe.lastIndex = 0;
    const pluginMatches = [...result.matchAll(/\{\{plugin:([^}]+)\}\}/gi)];
    for (const match of pluginMatches) {
      const funcName = match[1].trim();
      const entry = templateFunctions.get(funcName);
      if (entry) {
        try {
          await Promise.race([
            new Promise<void>((res) => { entry.sandbox.invokeCallback(entry.callbackId); res(); }),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
          ]);
          // invokeCallback is fire-and-forget (void); replace with empty string on success
          result = result.replace(match[0], '');
        } catch {
          result = result.replace(match[0], `{{plugin:${funcName} — error}}`);
        }
      }
    }
  }

  // Handle {{cursor}} placeholder
  let cursorOffset: number | null = null;
  const cursorIdx = result.indexOf('{{cursor}}');
  if (cursorIdx !== -1) {
    cursorOffset = cursorIdx;
    result = result.slice(0, cursorIdx) + result.slice(cursorIdx + 10);
  }

  return { text: result, cursorOffset };
}
