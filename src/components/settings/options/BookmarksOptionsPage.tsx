import { useTranslation } from 'react-i18next';
import { FeatureWiki } from '../../FeatureWiki';

export function BookmarksOptionsPage() {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('bookmarksOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('bookmarksOptions.description')}
        </span>
      </div>
      <FeatureWiki featureId="bookmarks-options" />
    </div>
  );
}
