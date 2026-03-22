import { useTranslation } from 'react-i18next';
import { FilePlus, FolderPlus, LayoutGrid } from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';
import type { FileEntry } from '../../types/index';
import { InputModal } from './InputModal';
import { TemplatePicker, type TemplateSelection } from './TemplatePicker';
import { MoveFileModal } from './MoveFileModal';

interface FileTreeModalsProps {
  entry: FileEntry;
  useTrash: boolean;
  templateFiles: FileEntry[];
  folderTemplates: FileEntry[];
  pendingCreateType: 'file' | 'folder';
  folders: string[];
  currentDir: string;

  newFileModal: boolean;
  newFolderModal: boolean;
  newCanvasModal: boolean;
  moveModalOpen: boolean;
  templatePickerOpen: boolean;
  deleteConfirmOpen: boolean;
  onNewFileClose: () => void;
  onNewFolderClose: () => void;
  onNewCanvasClose: () => void;
  onMoveClose: () => void;
  onTemplatePickerClose: () => void;
  onDeleteCancel: () => void;

  onNewFileSubmit: (name: string) => void;
  onNewFolderSubmit: (name: string) => void;
  onNewCanvasSubmit: (name: string) => void;
  onMoveConfirm: (target: string) => void;
  onTemplateSelect: (selection: TemplateSelection | null) => void;
  onDeleteConfirm: () => void;
}

export function FileTreeModals({
  entry, useTrash, templateFiles, folderTemplates, pendingCreateType, folders, currentDir,
  newFileModal, newFolderModal, newCanvasModal, moveModalOpen, templatePickerOpen,
  deleteConfirmOpen,
  onNewFileClose, onNewFolderClose, onNewCanvasClose, onMoveClose, onTemplatePickerClose, onDeleteCancel,
  onNewFileSubmit, onNewFolderSubmit, onNewCanvasSubmit, onMoveConfirm, onTemplateSelect, onDeleteConfirm,
}: FileTreeModalsProps) {
  const { t } = useTranslation('sidebar');

  return (
    <>
      {moveModalOpen && (
        <MoveFileModal
          open={moveModalOpen}
          fileName={entry.name}
          folders={folders}
          currentDir={currentDir}
          entryPath={entry.path}
          onClose={onMoveClose}
          onMove={onMoveConfirm}
        />
      )}

      {newFileModal && (
        <InputModal
          open={newFileModal}
          title={t('modals.newFile.title')}
          icon={<FilePlus size={14} />}
          placeholder={t('modals.newFile.placeholder')}
          submitLabel={t('modals.newFile.submitLabel')}
          onClose={onNewFileClose}
          onSubmit={onNewFileSubmit}
          validate={(name) => {
            const fileName = name.endsWith('.md') ? name : `${name}.md`;
            if (entry.children?.some((e) => !e.isDir && e.name.toLowerCase() === fileName.toLowerCase())) {
              return t('modals.newFile.alreadyExists');
            }
            return null;
          }}
        />
      )}

      {newFolderModal && (
        <InputModal
          open={newFolderModal}
          title={t('modals.newFolder.title')}
          icon={<FolderPlus size={14} />}
          placeholder={t('modals.newFolder.placeholder')}
          submitLabel={t('modals.newFolder.submitLabel')}
          onClose={onNewFolderClose}
          onSubmit={onNewFolderSubmit}
          validate={(name) => {
            if (entry.children?.some((e) => e.isDir && e.name.toLowerCase() === name.toLowerCase())) {
              return t('modals.newFolder.alreadyExists');
            }
            return null;
          }}
        />
      )}

      {newCanvasModal && (
        <InputModal
          open={newCanvasModal}
          title={t('modals.newCanvas.title')}
          icon={<LayoutGrid size={14} />}
          placeholder={t('modals.newCanvas.placeholder')}
          submitLabel={t('modals.newCanvas.submitLabel')}
          onClose={onNewCanvasClose}
          onSubmit={onNewCanvasSubmit}
          validate={(name) => {
            const fileName = name.endsWith('.canvas') ? name : `${name}.canvas`;
            if (entry.children?.some((e) => !e.isDir && e.name.toLowerCase() === fileName.toLowerCase())) {
              return t('modals.newCanvas.alreadyExists');
            }
            return null;
          }}
        />
      )}

      {templatePickerOpen && (
        <TemplatePicker
          open={templatePickerOpen}
          templates={pendingCreateType === 'file' ? templateFiles : []}
          folderTemplates={pendingCreateType === 'folder' ? folderTemplates : []}
          onClose={() => { onTemplatePickerClose(); }}
          onSelect={onTemplateSelect}
        />
      )}

      {deleteConfirmOpen && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          title={useTrash ? t('modals.delete.titleTrash') : t('modals.delete.titleDelete')}
          message={`${useTrash
            ? t('modals.delete.messageTrash', { target: entry.isDir ? t('modals.delete.targetFolder') : t('modals.delete.targetFile'), name: entry.name })
            : t('modals.delete.messageDelete', { target: entry.isDir ? t('modals.delete.targetFolder') : t('modals.delete.targetFile'), name: entry.name })}`}
          kind="warning"
          confirmLabel={useTrash ? t('modals.delete.confirmTrash') : t('modals.delete.confirmDelete')}
          onConfirm={onDeleteConfirm}
          onCancel={onDeleteCancel}
        />
      )}
    </>
  );
}
