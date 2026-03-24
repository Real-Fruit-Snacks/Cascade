interface SectionHeaderProps {
  label: string;
}

export function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div
      className="font-semibold mb-2 mt-1 pb-1 ctp-overlay1 border-b-ctp-surface0"
      style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
    >
      {label}
    </div>
  );
}
