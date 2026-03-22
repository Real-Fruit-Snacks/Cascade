interface SectionHeaderProps {
  label: string;
}

export function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div
      className="text-xs font-medium mb-2 mt-1 pb-1 ctp-overlay1 border-b-ctp-surface0"
    >
      {label}
    </div>
  );
}
