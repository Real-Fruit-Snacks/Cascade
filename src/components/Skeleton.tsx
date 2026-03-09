interface SkeletonLineProps {
  width?: string;
  height?: string;
}

export function SkeletonLine({ width = '100%', height = '12px' }: SkeletonLineProps) {
  return (
    <div
      className="skeleton-pulse rounded"
      style={{
        width,
        height,
        backgroundColor: 'var(--ctp-surface0)',
      }}
    />
  );
}

interface SkeletonBlockProps {
  width?: string;
  height?: string;
}

export function SkeletonBlock({ width = '100%', height = '48px' }: SkeletonBlockProps) {
  return (
    <div
      className="skeleton-pulse rounded"
      style={{
        width,
        height,
        backgroundColor: 'var(--ctp-surface0)',
      }}
    />
  );
}
