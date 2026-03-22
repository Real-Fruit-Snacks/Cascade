import { useTranslation } from 'react-i18next';
import type { FileSortOrder, AttachmentLocation } from '../../../stores/settings-store';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { SubHeader } from '../shared/SubHeader';
import type { CategoryPageProps } from '../shared/searchable-items';

export function FilesSettingsPage({ settings, visibleIds, isSearching }: CategoryPageProps) {
  const { t: ts } = useTranslation('settings');

  return (
    <>
      {!isSearching && <SubHeader label={ts('files.subheaders.explorer')} />}
      {(!visibleIds || visibleIds.has('fileSortOrder')) && (
        <SettingRow label={ts('files.sortOrder.label')} description={ts('files.sortOrder.description')}>
          <select
            value={settings.fileSortOrder}
            onChange={(e) => settings.update({ fileSortOrder: e.target.value as FileSortOrder })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            <option value="name-asc">{ts('files.sortOrder.nameAsc')}</option>
            <option value="name-desc">{ts('files.sortOrder.nameDesc')}</option>
            <option value="modified-newest">{ts('files.sortOrder.modifiedNewest')}</option>
            <option value="modified-oldest">{ts('files.sortOrder.modifiedOldest')}</option>
          </select>
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('showFileExtensions')) && (
        <SettingRow label={ts('files.showFileExtensions.label')} description={ts('files.showFileExtensions.description')}>
          <ToggleSwitch
            checked={settings.showFileExtensions}
            onChange={(v) => settings.update({ showFileExtensions: v })}
          />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('showFolderIcons')) && (
        <SettingRow label={ts('files.showFolderIcons.label')} description={ts('files.showFolderIcons.description')}>
          <ToggleSwitch
            checked={settings.showFolderIcons}
            onChange={(v) => settings.update({ showFolderIcons: v })}
          />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('showFileIcons')) && (
        <SettingRow label={ts('files.showFileIcons.label')} description={ts('files.showFileIcons.description')}>
          <ToggleSwitch
            checked={settings.showFileIcons}
            onChange={(v) => settings.update({ showFileIcons: v })}
          />
        </SettingRow>
      )}
      {!isSearching && <SubHeader label={ts('files.subheaders.deletion')} />}
      {(!visibleIds || visibleIds.has('confirmBeforeDelete')) && (
        <SettingRow label={ts('files.confirmBeforeDelete.label')} description={ts('files.confirmBeforeDelete.description')}>
          <ToggleSwitch
            checked={settings.confirmBeforeDelete}
            onChange={(v) => settings.update({ confirmBeforeDelete: v })}
          />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('useTrash')) && (
        <SettingRow label={ts('files.moveToTrash.label')} description={ts('files.moveToTrash.description')}>
          <ToggleSwitch
            checked={settings.useTrash}
            onChange={(v) => settings.update({ useTrash: v })}
          />
        </SettingRow>
      )}
      {!isSearching && <SubHeader label={ts('files.subheaders.attachmentsTemplates')} />}
      {(!visibleIds || visibleIds.has('templatesFolder')) && (
        <SettingRow label={ts('files.templatesFolder.label')} description={ts('files.templatesFolder.description')}>
          <input
            type="text"
            value={settings.templatesFolder}
            onChange={(e) => settings.update({ templatesFolder: e.target.value })}
            className="text-xs px-2 py-1 rounded outline-none w-32 ctp-input"
            placeholder={ts('files.templatesFolder.placeholder')}
          />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('attachmentLocation')) && (
        <SettingRow label={ts('files.attachmentLocation.label')} description={ts('files.attachmentLocation.description')}>
          <select
            value={settings.attachmentLocation}
            onChange={(e) => settings.update({ attachmentLocation: e.target.value as AttachmentLocation })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            <option value="vault-folder">{ts('files.attachmentLocation.vaultFolder')}</option>
            <option value="same-folder">{ts('files.attachmentLocation.sameFolder')}</option>
          </select>
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('attachmentsFolder')) && settings.attachmentLocation === 'vault-folder' && (
        <SettingRow label={ts('files.attachmentsFolder.label')} description={ts('files.attachmentsFolder.description')}>
          <input
            type="text"
            value={settings.attachmentsFolder}
            onChange={(e) => settings.update({ attachmentsFolder: e.target.value })}
            className="text-xs px-2 py-1 rounded outline-none w-32 ctp-input"
            placeholder={ts('files.attachmentsFolder.placeholder')}
          />
        </SettingRow>
      )}
    </>
  );
}
