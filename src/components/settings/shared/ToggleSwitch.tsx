export function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative rounded-full transition-colors"
      style={{
        width: 36,
        height: 20,
        backgroundColor: checked ? 'var(--ctp-accent)' : 'var(--ctp-surface2)',
      }}
    >
      <span
        className="absolute rounded-full transition-transform"
        style={{
          width: 16,
          height: 16,
          top: 2,
          left: 0,
          backgroundColor: 'var(--ctp-base)',
          transform: checked ? 'translateX(18px)' : 'translateX(2px)',
        }}
      />
    </button>
  );
}
