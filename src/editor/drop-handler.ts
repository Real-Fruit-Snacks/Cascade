import { EditorView } from '@codemirror/view';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import { useEditorStore } from '../stores/editor-store';
import { saveAttachment } from '../lib/tauri-commands';
import { createLogger } from '../lib/logger';

const log = createLogger('DropHandler');

const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i;
const URL_RE = /^https?:\/\/\S+$/i;

function getAttachmentFolder(): string {
  const settings = useSettingsStore.getState();
  if (settings.attachmentLocation === 'same-folder') {
    const activeFile = useEditorStore.getState().activeFilePath;
    if (activeFile) {
      const parts = activeFile.replace(/\\/g, '/').split('/');
      parts.pop(); // remove filename
      return parts.join('/'); // folder path (empty string for root)
    }
  }
  return settings.attachmentsFolder;
}

async function handleImagePaste(view: EditorView, file: File) {
  const vaultPath = useVaultStore.getState().vaultPath;
  if (!vaultPath) return;

  const timestamp = Date.now();
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  const filename = `paste-${timestamp}.${ext}`;
  const folder = getAttachmentFolder();

  const buffer = await file.arrayBuffer();
  const data = Array.from(new Uint8Array(buffer));

  try {
    let relPath = await saveAttachment(vaultPath, folder, filename, data);
    // Ensure vault-root-relative path so resolveImageSrc resolves correctly
    if (!relPath.startsWith('/')) relPath = '/' + relPath;
    const mdLink = `![](${relPath})`;
    const pos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: pos, insert: mdLink },
      selection: { anchor: pos + mdLink.length },
    });
    // Refresh file tree to show the new attachment
    useVaultStore.getState().refreshTree();
  } catch (err) {
    log.warn('Failed to save pasted image:', err);
  }
}

export const dropHandler = EditorView.domEventHandlers({
  paste(event, view) {
    // Paste URL into selection: wrap selected text as [text](url)
    const sel = view.state.selection.main;
    if (!sel.empty && useSettingsStore.getState().pasteUrlIntoSelection) {
      const clipText = event.clipboardData?.getData('text/plain')?.trim();
      if (clipText && URL_RE.test(clipText)) {
        const selectedText = view.state.sliceDoc(sel.from, sel.to);
        // Skip multi-line selections — they produce broken markdown links
        if (selectedText.includes('\n')) return false;
        event.preventDefault();
        // Percent-encode unbalanced parens in the URL to avoid breaking markdown link syntax
        const safeUrl = clipText.replace(/\)/g, '%29');
        const mdLink = `[${selectedText}](${safeUrl})`;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: mdLink },
          selection: { anchor: sel.from + mdLink.length },
        });
        return true;
      }
    }

    const items = event.clipboardData?.items;
    if (!items) return false;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          handleImagePaste(view, file);
          return true;
        }
      }
    }
    return false;
  },
  drop(event, view) {
    const filePath = event.dataTransfer?.getData('cascade/file-path');
    if (!filePath) return false;

    event.preventDefault();

    const normalized = filePath.replace(/\\/g, '/');
    const basename = normalized.split('/').pop() ?? filePath;

    let wikiLink: string;
    if (IMAGE_EXTENSIONS.test(basename)) {
      const name = basename.replace(IMAGE_EXTENSIONS, '');
      wikiLink = `![[${name}]]`;
    } else {
      const name = basename.replace(/\.md$/i, '');
      wikiLink = `[[${name}]]`;
    }

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    view.dispatch({
      changes: { from: pos, insert: wikiLink },
      selection: { anchor: pos + wikiLink.length },
    });
    view.focus();
    return true;
  },
  dragover(event) {
    if (event.dataTransfer?.types.includes('cascade/file-path')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      return true;
    }
    return false;
  },
});
