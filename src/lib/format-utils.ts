/**
 * Format a timestamp as a relative "X ago" string.
 * Uses the provided translation function for i18n support.
 */
export function formatAgo(
  time: number | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!time) return t('never');
  const secs = Math.floor((Date.now() - time) / 1000);
  if (secs < 60) return t('justNow');
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t('minutesAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  return t('hoursAgo', { count: hrs });
}
