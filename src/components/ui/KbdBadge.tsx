interface KbdBadgeProps {
  shortcut: string;
}

export function KbdBadge({ shortcut }: KbdBadgeProps) {
  const parts = shortcut.split('+');
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {parts.map((key, i) => (
        <kbd
          key={i}
          className="px-1 py-0.5 rounded text-[0.6rem] leading-none"
          style={{
            color: 'var(--ctp-overlay0)',
            background: 'var(--ctp-surface0)',
            border: '1px solid var(--ctp-surface2)',
            fontFamily: 'inherit',
          }}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
