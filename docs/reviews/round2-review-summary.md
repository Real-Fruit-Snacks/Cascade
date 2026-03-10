# Round 2 Code Review — Summary

**Date:** 2026-03-10
**Scope:** 10 feature areas, 118 issues identified, critical/high issues fixed

## Areas Reviewed

1. Editor Core (CM6, live preview, vim mode, formatting)
2. File Management (vault explorer, file tree, new file modal, rename)
3. Search & Replace
4. Backlinks & Graph
5. Canvas
6. Sidebar & Navigation
7. Settings & Preferences
8. Plugin System
9. Import/Export
10. Git Sync & Merge Conflicts

## Critical Issues Fixed

### 1. Canvas — Promise leak on modal cancel (CanvasView.tsx:204-212)
**Problem:** `requestInput` returned a Promise that was never resolved when the user cancelled the CanvasInputModal, causing a memory leak.
**Fix:** Added `onCancel` callback that resolves the Promise with `null`.

### 2. Canvas — TextCard/FileCard unmount data loss (TextCard.tsx, FileCard.tsx)
**Problem:** When a card component unmounted while a debounced save was pending, the timer was cleared but the pending content was never flushed, causing data loss.
**Fix:** Unmount cleanup now calls `flushSave()` when a pending timer exists, using a ref to avoid stale closure.

### 3. Search — `replace_in_files` ignoring wholeWord (search.rs, SearchModal.tsx)
**Problem:** `search_vault` supported `whole_word` parameter but `replace_in_files` did not. The SearchModal had a wholeWord toggle but never passed it to replace operations, causing replacements to match partial words.
**Fix:** Added `whole_word` parameter to `replace_in_files` (Rust), `replaceInFiles` (TS wrapper), and the SearchModal call site.

### 4. Plugin API — No size limit on vault writes (sandbox.ts)
**Problem:** Plugin `vault.writeFile` had no size limit, unlike the editor's 5MB cap. A malicious or buggy plugin could write arbitrarily large files.
**Fix:** Added 5MB size check before `writeFile` call in plugin sandbox.

## High Issues Fixed (Prior Session)

### 5. Binary file crash — UTF-8 error (editor-store.ts)
When `enableMediaViewer` was disabled, opening images/PDFs fell through to text reader, causing UTF-8 decode error. Fixed with early return + toast.

### 6. Vim mode — Arrow keys not working (use-codemirror.ts)
`vim()` extension lacked `Prec.highest` wrapper, causing keymap conflicts. Fixed by wrapping in `Prec.highest()`.

### 7. Settings — Redundant toggles (SettingsModal.tsx)
Spellcheck and Bookmarks feature pages had duplicate enable/disable toggles already present on the main features page. Removed duplicates.

### 8. File rename — Double-fire on Enter+blur (FileTreeItem.tsx)
Pressing Enter triggered both `onKeyDown` and `onBlur`, causing duplicate rename attempts. Fixed with `isCommittingRename` ref guard.

### 9. File creation — Missing error handling (VaultExplorer.tsx)
`handleNewFile` and folder creation had no try/catch. Added error toasts.

### 10. New file — Reserved filename validation (NewFileModal.tsx)
Windows reserved names (CON, PRN, AUX, NUL, COM0-9, LPT0-9) were not rejected. Added validation.

## Issues Verified as Non-Issues

| Reported Issue | Finding |
|---|---|
| XSS via innerHTML in TransclusionWidget | `renderMarkdownPreview` uses `escapeHtml` + `isSafeUrl` — safe |
| XSS in SettingsModal dangerouslySetInnerHTML | Uses `rehype-sanitize` in unified pipeline — safe |
| Notion importer zip path traversal | `clean_zip_path` filters parent/root components — safe |
| HTML export title XSS | No HTML export feature exists |
| Hardcoded "main" branch in git sync | No hardcoded branch name found |
| BacklinksPanel race condition | Read-modify-write is acceptable for single-user app |

## Remaining Low/Medium Items (Not Fixed)

- Shared mutable module state in `use-codemirror.ts` (Compartment instances) — works fine for single-editor-per-tab pattern
- MergeConflictDialog could benefit from refresh on re-open — low priority
- `image-controls.ts` uses innerHTML with SVG literals — safe (hardcoded strings, no user input)
- `mermaid-preview.ts` sets innerHTML with mermaid SVG output — mermaid handles its own sanitization
