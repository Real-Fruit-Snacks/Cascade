# Comprehensive Application Review Summary

**Date:** 2026-03-10
**Branch:** `review/comprehensive-app-review`

## Overview

Full review of all 10 areas of the Cascade application covering backend, editor engine, state management, UI shell, feature UIs, canvas, importers, plugin system, git sync, and cross-cutting concerns.

## Statistics

| Metric | Count |
|--------|-------|
| **Total findings** | 152 |
| **Fixed** | 104 |
| **Deferred** | 48 |
| **Fix rate** | 68% |

## Per-Area Breakdown

| Area | Fixed | Deferred | Total |
|------|-------|----------|-------|
| 1. Core Backend (Rust) | 13 | 0 | 13 |
| 2. Editor Engine (CM6) | 6 | 3 | 9 |
| 3. Stores & State | 4 | 1 | 5 |
| 4. Main UI Shell | 7 | 8 | 15 |
| 5. Feature UIs | 4 | 10 | 14 |
| 6. Canvas | 7 | 9 | 16 |
| 7. Importers | 13 | 3 | 16 |
| 8. Plugin System | 8 | 4 | 12 |
| 9. Git Sync | 10 | 4 | 14 |
| 10. Cross-Cutting | 32 | 6 | 38 |

## Key Fixes by Category

### Security (Critical)
- Path traversal protection in `list_file_history` and `extract_plugin_zip`
- URL scheme validation in canvas `LinkCard` (blocks `javascript:` URLs)
- Sandbox iframe `sandbox` attribute on PDF export
- Path traversal validation in plugin sandbox RPC handlers
- Single-quote escaping in SVG export `escapeXml`

### Correctness
- `matchesShortcut` now validates Meta key (was voided with `void meta`)
- `signature()` in git.rs no longer panics — returns `Result`
- Widget equality comparisons now include all fields (alignments, alt, rawUrl)
- `parseTableRow` handles escaped pipes correctly
- Negative timestamp guard in Roam importer
- `onCardMouseDown` undo deferred to first actual movement
- `fitNodeToContent` batched into single undo entry
- Sync race condition guard in `refreshStatus`

### Performance
- `CanvasBackground` caches `getComputedStyle` (7+ calls/frame → 1)
- `saveDrafts` early-exit when no dirty tabs
- Removed wasteful `useShallow((s) => s)` in SettingsModal
- `handleKeyDown` early-exit for non-modifier keystrokes
- `enablePlugin` removed unnecessary async

### Accessibility
- Keyboard-accessible split pane divider (arrow keys + Shift)
- Home/End key support in context menus
- `role="button"` and keyboard handler on sync status indicator
- `role="alert"` and `aria-live="assertive"` on ErrorBoundary
- Platform-aware keyboard shortcuts (Ctrl vs Cmd)

### UX
- Confirmation dialog before vault-wide search-and-replace
- Debounced PAT keyring saves (500ms instead of every keystroke)
- Distinct offline status color in sync indicator
- Shift+Arrow nudge convention corrected (Shift = large, plain = fine)
- Keyboard zoom anchored to screen center

### Test Coverage
- New test suites: `path-utils.test.ts` (6 tests), `tag-utils.test.ts` (10 tests), `wiki-link-resolver.test.ts` (14 tests)
- Additional `toc.test.ts` edge cases for slugify
- Error i18n keys populated (15 keys)

### Importer Quality
- Bear: filename truncation, attachment error propagation
- Notion: complete percent-decoding, strikethrough/checkbox support, code block language detection, dead code removal
- Roam: YAML title escaping, negative timestamp safety

## Verification

All changes verified at each checkpoint:
- `npx tsc --noEmit` — 0 errors
- `npm run lint` — 0 errors
- `npm test` — 176/176 passing
- `cargo check` — OK
- `cargo test` — 55/55 passing

## Deferred Items

See [`deferred-risky-items.md`](./deferred-risky-items.md) for full list. Major categories:
- **Large component refactors** (AppShell 740+ lines, GraphPanel 900 lines, ExportModal 1080+ lines)
- **i18n gaps** (8 components with hardcoded English)
- **Architectural changes** (PDF export, canvas virtualization, Web Worker offloading, clipboard API)
- **UX improvements requiring new UI** (canvas prompt() replacement, drag-past-edge, inline editing)
- **Plugin system** (sidebar API mismatch, settings permissions, registry validation)

## Commits

1. `c471fb1` — review: fix issues in core backend, editor engine, and stores (areas 1-3)
2. `7f54eca` — review: fix issues in UI shell, feature UIs, and canvas (areas 4-6)
3. `f5e6d42` — review: fix deferred items across areas 2-6
4. `586bbfc` — review: complete areas 7-10 (importers, plugins, git sync, cross-cutting)
5. Final commit — review checklist updates and summary
