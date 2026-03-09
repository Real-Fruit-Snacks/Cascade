import { readFile, writeFile, createFolder } from './tauri-commands';
import { useSettingsStore } from '../stores/settings-store';
import { useEditorStore } from '../stores/editor-store';
import { applyTemplateVariables, formatDateCustom, resolveTemplateIncludes } from './template-utils';

async function openPeriodicNote(
  vaultPath: string,
  folder: string,
  format: string,
  template: string,
  date: Date,
): Promise<void> {
  const formatted = formatDateCustom(date, format);
  const filePath = `${folder}/${formatted}.md`;

  let fileExists = false;
  try {
    await readFile(vaultPath, filePath);
    fileExists = true;
  } catch {
    fileExists = false;
  }

  let cursorOffset: number | null = null;

  if (!fileExists) {
    try {
      await createFolder(vaultPath, folder);
    } catch { /* Folder may already exist */ }

    let content = '';
    if (template) {
      try {
        let templateContent = await readFile(vaultPath, template);
        templateContent = await resolveTemplateIncludes(templateContent, (p) => readFile(vaultPath, p));
        let clipboard = '';
        try { clipboard = await navigator.clipboard.readText(); } catch { /* clipboard unavailable */ }
        const result = await applyTemplateVariables(templateContent, filePath, clipboard);
        content = result.text;
        cursorOffset = result.cursorOffset;
      } catch {
        content = '';
      }
    }

    await writeFile(vaultPath, filePath, content);
  }

  useEditorStore.getState().openFile(vaultPath, filePath);

  if (cursorOffset !== null) {
    const offset = cursorOffset;
    setTimeout(() => {
      const view = useEditorStore.getState().editorViewRef.current;
      if (view) {
        const pos = Math.min(offset, view.state.doc.length);
        view.dispatch({ selection: { anchor: pos } });
        view.focus();
      }
    }, 200);
  }
}

export async function openDailyNote(vaultPath: string): Promise<void> {
  const s = useSettingsStore.getState();
  await openPeriodicNote(vaultPath, s.dailyNotesFolder, s.dailyNotesFormat, s.dailyNotesTemplate, new Date());
}

export async function openWeeklyNote(vaultPath: string): Promise<void> {
  const s = useSettingsStore.getState();
  await openPeriodicNote(vaultPath, s.weeklyNotesFolder, s.weeklyNotesFormat, s.weeklyNotesTemplate, new Date());
}

export async function openMonthlyNote(vaultPath: string): Promise<void> {
  const s = useSettingsStore.getState();
  await openPeriodicNote(vaultPath, s.monthlyNotesFolder, s.monthlyNotesFormat, s.monthlyNotesTemplate, new Date());
}

export async function openQuarterlyNote(vaultPath: string): Promise<void> {
  const s = useSettingsStore.getState();
  await openPeriodicNote(vaultPath, s.quarterlyNotesFolder, s.quarterlyNotesFormat, s.quarterlyNotesTemplate, new Date());
}

export async function openYearlyNote(vaultPath: string): Promise<void> {
  const s = useSettingsStore.getState();
  await openPeriodicNote(vaultPath, s.yearlyNotesFolder, s.yearlyNotesFormat, s.yearlyNotesTemplate, new Date());
}
