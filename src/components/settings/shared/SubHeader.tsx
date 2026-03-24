interface SubHeaderProps {
  label: string;
}

export function SubHeader({ label }: SubHeaderProps) {
  return (
    <div
      className="font-semibold uppercase mt-2 mb-1 ctp-accent"
      style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.05em' }}
    >
      {label}
    </div>
  );
}
