import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import type { CategoryPageProps } from '../shared/searchable-items';

export function FeaturesSettingsPage({ settings, visibleIds }: CategoryPageProps) {
  const { t: ts } = useTranslation('settings');

  return (
    <>
      {(!visibleIds || visibleIds.has('autoSaveEnabled')) && (
        <SettingRow label={ts('features.autoSave.label')} description={ts('features.autoSave.description')}>
          <ToggleSwitch checked={settings.autoSaveEnabled} onChange={(v) => settings.update({ autoSaveEnabled: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableBacklinks')) && (
        <SettingRow label={ts('features.backlinks.label')} description={ts('features.backlinks.description')}>
          <ToggleSwitch checked={settings.enableBacklinks} onChange={(v) => settings.update({ enableBacklinks: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableBookmarks')) && (
        <SettingRow label={ts('features.bookmarks.label')} description={ts('features.bookmarks.description')}>
          <ToggleSwitch checked={settings.enableBookmarks} onChange={(v) => settings.update({ enableBookmarks: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableCalloutPreview')) && (
        <SettingRow label={ts('features.calloutPreview.label')} description={ts('features.calloutPreview.description')}>
          <ToggleSwitch checked={settings.enableCalloutPreview} onChange={(v) => settings.update({ enableCalloutPreview: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableCanvas')) && (
        <SettingRow label={ts('features.canvas.label')} description={ts('features.canvas.description')}>
          <ToggleSwitch checked={settings.enableCanvas} onChange={(v) => settings.update({ enableCanvas: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableCodeFolding')) && (
        <SettingRow label={ts('features.codeFolding.label')} description={ts('features.codeFolding.description')}>
          <ToggleSwitch checked={settings.enableCodeFolding} onChange={(v) => settings.update({ enableCodeFolding: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableDailyNotes')) && (
        <SettingRow label={ts('features.dailyNotes.label')} description={ts('features.dailyNotes.description')}>
          <ToggleSwitch checked={settings.enableDailyNotes} onChange={(v) => settings.update({ enableDailyNotes: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableFocusMode')) && (
        <SettingRow label={ts('features.focusMode.label')} description={ts('features.focusMode.description')}>
          <ToggleSwitch checked={settings.enableFocusMode} onChange={(v) => settings.update({ enableFocusMode: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableFolderColors')) && (
        <SettingRow label={ts('features.folderColors.label')} description={ts('features.folderColors.description')}>
          <ToggleSwitch checked={settings.enableFolderColors} onChange={(v) => settings.update({ enableFolderColors: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableGraphView')) && (
        <SettingRow label={ts('features.graphView.label')} description={ts('features.graphView.description')}>
          <ToggleSwitch checked={settings.enableGraphView} onChange={(v) => settings.update({ enableGraphView: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableHighlightSyntax')) && (
        <SettingRow label={ts('features.highlightSyntax.label')} description={ts('features.highlightSyntax.description')}>
          <ToggleSwitch checked={settings.enableHighlightSyntax} onChange={(v) => settings.update({ enableHighlightSyntax: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableImagePreview')) && (
        <SettingRow label={ts('features.imagePreview.label')} description={ts('features.imagePreview.description')}>
          <ToggleSwitch checked={settings.enableImagePreview} onChange={(v) => settings.update({ enableImagePreview: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableIndentGuides')) && (
        <SettingRow label={ts('features.indentGuides.label')} description={ts('features.indentGuides.description')}>
          <ToggleSwitch checked={settings.enableIndentGuides} onChange={(v) => settings.update({ enableIndentGuides: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableLivePreview')) && (
        <SettingRow label={ts('features.livePreview.label')} description={ts('features.livePreview.description')}>
          <ToggleSwitch checked={settings.enableLivePreview} onChange={(v) => settings.update({ enableLivePreview: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableMathPreview')) && (
        <SettingRow label={ts('features.mathPreview.label')} description={ts('features.mathPreview.description')}>
          <ToggleSwitch checked={settings.enableMathPreview} onChange={(v) => settings.update({ enableMathPreview: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableMediaViewer')) && (
        <SettingRow label={ts('features.mediaViewer.label')} description={ts('features.mediaViewer.description')}>
          <ToggleSwitch checked={settings.enableMediaViewer} onChange={(v) => settings.update({ enableMediaViewer: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableMermaidPreview')) && (
        <SettingRow label={ts('features.mermaidDiagrams.label')} description={ts('features.mermaidDiagrams.description')}>
          <ToggleSwitch checked={settings.enableMermaidPreview} onChange={(v) => settings.update({ enableMermaidPreview: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableOutline')) && (
        <SettingRow label={ts('features.outline.label')} description={ts('features.outline.description')}>
          <ToggleSwitch checked={settings.enableOutline} onChange={(v) => settings.update({ enableOutline: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableProperties')) && (
        <SettingRow label={ts('features.propertiesWidget.label')} description={ts('features.propertiesWidget.description')}>
          <ToggleSwitch checked={settings.enableProperties} onChange={(v) => settings.update({ enableProperties: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableQueryPreview')) && (
        <SettingRow label={ts('features.queryPreview.label')} description={ts('features.queryPreview.description')}>
          <ToggleSwitch checked={settings.enableQueryPreview} onChange={(v) => settings.update({ enableQueryPreview: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableSearch')) && (
        <SettingRow label={ts('features.searchInVault.label')} description={ts('features.searchInVault.description')}>
          <ToggleSwitch checked={settings.enableSearch} onChange={(v) => settings.update({ enableSearch: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('spellcheck')) && (
        <SettingRow label={ts('features.spellcheck.label')} description={ts('features.spellcheck.description')}>
          <ToggleSwitch checked={settings.spellcheck} onChange={(v) => settings.update({ spellcheck: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableSlashCommands')) && (
        <SettingRow label={ts('features.slashCommands.label')} description={ts('features.slashCommands.description')}>
          <ToggleSwitch checked={settings.enableSlashCommands} onChange={(v) => settings.update({ enableSlashCommands: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableStatusBar')) && (
        <SettingRow label={ts('features.statusBar.label')} description={ts('features.statusBar.description')}>
          <ToggleSwitch checked={settings.enableStatusBar} onChange={(v) => settings.update({ enableStatusBar: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('syncEnabled')) && (
        <SettingRow label={ts('features.sync.label')} description={ts('features.sync.description')}>
          <ToggleSwitch checked={settings.syncEnabled} onChange={(v) => settings.update({ syncEnabled: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableTableOfContents')) && (
        <SettingRow label={ts('features.tableOfContents.label')} description={ts('features.tableOfContents.description')}>
          <ToggleSwitch checked={settings.enableTableOfContents} onChange={(v) => settings.update({ enableTableOfContents: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableTags')) && (
        <SettingRow label={ts('features.tags.label')} description={ts('features.tags.description')}>
          <ToggleSwitch checked={settings.enableTags} onChange={(v) => settings.update({ enableTags: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableTemplates')) && (
        <SettingRow label={ts('features.templates.label')} description={ts('features.templates.description')}>
          <ToggleSwitch checked={settings.enableTemplates} onChange={(v) => settings.update({ enableTemplates: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableTypewriterMode')) && (
        <SettingRow label={ts('features.typewriterMode.label')} description={ts('features.typewriterMode.description')}>
          <ToggleSwitch checked={settings.enableTypewriterMode} onChange={(v) => settings.update({ enableTypewriterMode: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableVariables')) && (
        <SettingRow label={ts('features.variables.label')} description={ts('features.variables.description')}>
          <ToggleSwitch checked={settings.enableVariables} onChange={(v) => settings.update({ enableVariables: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('showWelcomeView')) && (
        <SettingRow label={ts('features.welcomeView.label')} description={ts('features.welcomeView.description')}>
          <ToggleSwitch checked={settings.showWelcomeView} onChange={(v) => settings.update({ showWelcomeView: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableWikiLinks')) && (
        <SettingRow label={ts('features.wikiLinks.label')} description={ts('features.wikiLinks.description')}>
          <ToggleSwitch checked={settings.enableWikiLinks} onChange={(v) => settings.update({ enableWikiLinks: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('enableWordCountGoal')) && (
        <SettingRow label={ts('features.wordCountGoal.label')} description={ts('features.wordCountGoal.description')}>
          <ToggleSwitch checked={settings.enableWordCountGoal} onChange={(v) => settings.update({ enableWordCountGoal: v })} />
        </SettingRow>
      )}
    </>
  );
}
