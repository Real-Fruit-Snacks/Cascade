interface SectionHeaderProps {
  label: string;
}

export function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div
      className="text-xs font-medium mb-2 mt-1 pb-1"
      style={{ color: 'var(--ctp-overlay1)', borderBottom: '1px solid var(--ctp-surface0)' }}
    >
      {label}
    </div>
  );
}
