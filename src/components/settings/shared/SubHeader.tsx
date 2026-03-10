interface SubHeaderProps {
  label: string;
}

export function SubHeader({ label }: SubHeaderProps) {
  return (
    <div
      className="text-[0.65rem] font-semibold uppercase tracking-wider mt-2 mb-1"
      style={{ color: 'var(--ctp-accent)' }}
    >
      {label}
    </div>
  );
}
