import type { SVGProps } from 'react';

/**
 * Custom icon for the Variables feature.
 * Shows angle brackets with a dot: <·> to represent <Variable> syntax.
 */
export function VariablesIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 24, ...rest } = props;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {/* Left angle bracket < */}
      <polyline points="8 6 3 12 8 18" />
      {/* Right angle bracket > */}
      <polyline points="16 6 21 12 16 18" />
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
