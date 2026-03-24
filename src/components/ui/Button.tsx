import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[var(--ctp-accent)] text-[var(--ctp-base)] hover:brightness-110 active:scale-[0.97]',
  secondary:
    'bg-[var(--ctp-surface1)] text-[var(--ctp-text)] hover:bg-[var(--ctp-surface2)] active:scale-[0.97]',
  ghost:
    'bg-transparent text-[var(--ctp-overlay1)] hover:bg-[var(--ctp-surface0)]',
  danger:
    'bg-[var(--ctp-red)] text-[var(--ctp-base)] hover:brightness-110 active:scale-[0.97]',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'text-xs px-2 py-1 rounded',
  md: 'text-xs px-3 py-1.5 rounded',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 font-medium',
        'transition-[background-color,filter,transform,opacity] duration-[150ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ctp-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--ctp-base)]',
        'select-none cursor-pointer',
        variantClasses[variant],
        sizeClasses[size],
        disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
