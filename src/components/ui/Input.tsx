import React from 'react';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={[
        'text-xs px-2 py-1 rounded',
        'bg-[var(--ctp-surface0)] text-[var(--ctp-text)]',
        'border border-[var(--ctp-surface2)]',
        'placeholder:text-[var(--ctp-overlay0)]',
        'transition-[border-color,box-shadow] duration-[150ms]',
        'focus:outline-none focus:border-[var(--ctp-accent)] focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--ctp-accent)_20%,transparent)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
