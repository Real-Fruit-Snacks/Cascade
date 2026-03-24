export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        'relative rounded-full shrink-0',
        'transition-colors duration-[200ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ctp-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--ctp-base)]',
        checked ? 'bg-[var(--ctp-accent)]' : 'bg-[var(--ctp-surface2)]',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: 36, height: 20 }}
    >
      <span
        className="absolute rounded-full transition-transform duration-[200ms] bg-[var(--ctp-base)]"
        style={{
          width: 16,
          height: 16,
          top: 2,
          left: 0,
          transform: checked ? 'translateX(18px)' : 'translateX(2px)',
        }}
      />
    </button>
  );
}
