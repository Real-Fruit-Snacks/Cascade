# Deferred Risky Items

Items deemed too risky to fix during the review pass. These require architectural changes,
new UI components, or large refactors that could introduce regressions.

## Large Component Refactors
- [ ] AppShell.tsx (740+ lines) — extract variables option-building (duplicated 7 times), extract shortcut handling into dedicated hook
- [ ] GraphPanel.tsx (~900 lines) — separate simulation logic, canvas rendering, settings UI, and mouse handling into sub-modules
- [ ] ExportModal.tsx (~1080 lines) — extract `markdownToHtml`, `markdownToDocx`, `performBatchExport` into `src/lib/export-utils.ts`
- [ ] QuickOpen.tsx — heavy inline markdown preview parser runs on every selection change; extract to shared preview utility

## i18n Gaps (8 components)
- [ ] FileConflictDialog — all strings hardcoded English
- [ ] OnboardingScreen — section labels hardcoded English (beyond shortcuts which were fixed)
- [ ] FeatureWiki — all section labels hardcoded English
- [ ] NewFileModal — hardcoded English
- [ ] ListVariablesModal — hardcoded English
- [ ] SetVariableModal — hardcoded English
- [ ] ErrorBoundary — hardcoded English
- [ ] ToastContainer — hardcoded English
- [ ] WelcomeView `formatRelativeTime` — returns hardcoded English strings ("just now", "yesterday", etc.)

## Architectural Changes
- [ ] PDF export — currently uses browser print dialog via iframe instead of actual PDF generation; user picks save path that is never used
- [ ] PdfViewer — creates all page canvases upfront; needs virtualization for large PDFs
- [ ] Canvas `forceLayout` — O(n²) × 50 iterations on main thread; needs Web Worker offloading for >100 nodes
- [ ] Canvas `structuredClone` in `pushUndo` — deep-clones entire state on every mutation; consider structural sharing or immutable data
- [ ] Canvas dirty-rect tracking — `CanvasBackground` re-renders everything on any change; separate static grid from dynamic layer
- [ ] Canvas copy/paste — uses module-level variable instead of system clipboard; needs Tauri clipboard API integration
- [ ] ErrorBoundary — only wraps AppShell; individual feature UIs should have their own error boundaries

## UX Improvements Requiring New UI
- [ ] Canvas `prompt()` for link URLs and edge labels — should use in-app modal/inline input instead
- [ ] Canvas drag past edge — dragging node past canvas boundary cancels operation; should continue tracking
- [ ] Canvas double-click empty space — new text node should auto-enter edit mode
- [ ] Tag rename in TagPanel — commits on blur with no visible cancel affordance besides Escape
- [ ] FileTreeItem renders modals for every tree item — should lazy-render (only mount when that item's modal is open)
- [ ] Modal z-index inconsistency — some modals use `createPortal` to document.body, others render inline

## Security (Area 10)
- [ ] Asset protocol scope includes `"C:/**"` and `"D:/**"` — overly broad, but required for Tauri asset loading from arbitrary vault paths on Windows; restricting to vault-only scope would break image/attachment loading
- [ ] CSP `style-src 'unsafe-inline'` — required for Tailwind runtime styles and inline `style` props; removing would break all dynamic styling

## Test Coverage (Area 10)
- [ ] No tests for `daily-notes.ts` — requires mocking Tauri `invoke`, Zustand store state (`useSettingsStore`, `useEditorStore`), and `navigator.clipboard`; complex integration test setup

## Plugin System (Area 8)
- [ ] Sandbox bootstrap `addSidebarPanel(id, component)` sends only the id to host RPC, but host destructures `{ id, html }` from `args[0]` — API contract mismatch requires coordinated sandbox bootstrap JS, RPC handler, and type changes
- [ ] `ui.removeCommand` is unimplemented — commands can be added but not individually removed at runtime; cleanup-on-destroy works, but runtime removal requires command registry changes
- [ ] Plugin settings RPC (`settings.get`/`settings.set`) has no permission gate — any plugin can read/write its own settings without declaring a permission; adding a new permission type would be a breaking API change
- [ ] Registry fetch (`plugin-registry.ts`) does not validate individual plugin/theme objects from JSON — malformed entries with missing fields are cast via `as RegistryPlugin` without runtime checks

## Git Sync (Area 9)
- [ ] Conflict resolution UX — currently auto-resolves by keeping local version and writing `.conflict.md` for remote; users have no merge UI to compare and choose
- [ ] `ensure_gitignore` silently ignores write errors — low risk but should propagate failure on repo init
- [ ] `unpushedCommits` offline tracking is approximate (increments per sync cycle) — needs accurate revwalk count after reconnect
- [ ] `formatAgo` utility duplicated in `SyncStatusIndicator.tsx` and `SettingsModal.tsx` — extract to shared `src/lib/format-utils.ts`
- [ ] SyncOptionsPage and SyncStatusIndicator strings are hardcoded English — needs i18n treatment

## Importer Infrastructure (Area 7)
- [ ] `ImportResult` struct duplicated in `bear_importer.rs`, `notion_importer.rs`, and `roam_importer.rs` — should be defined once in `importer.rs` and re-exported; touching all three modules risks merge conflicts
- [ ] No progress feedback during import — all three importers run synchronously on the Tauri command thread with no events emitted to the frontend; adding async streaming requires Tauri event channel plumbing and frontend listener UI
- [ ] Bear tag regex `#([^#\n]+)#` can false-match content inside inline code or between unrelated `#` characters — fixing requires context-aware parsing (skip code spans/blocks) which is a significant rewrite of `convert_bear_markdown`

## Minor Items
- [ ] QuickOpen `previewCache` is module-level Map persisting across mount/unmount
- [ ] wiki-link-resolver cache uses referential equality (works only because store replaces array)
- [ ] ContextMenu `onClose` in useEffect deps causes listener churn if parent doesn't memoize
- [ ] CSS inconsistency — mix of Tailwind utility classes and inline style objects across shell components
- [ ] Tooltip `tooltip-fade-in`/`tooltip-fade-out` animations reference undefined @keyframes
- [ ] SetVariableModal duplicates sidebar localStorage key constants
- [ ] `HEADING_STYLES` in live-preview helpers.ts duplicates heading values from theme.ts
- [ ] `renderMarkdownPreview` uses fragile regex-based markdown parsing (acceptable for transclusion previews)
- [ ] Canvas `CanvasMinimap` has duplicate `resolveCssVar` helper differing from `canvas-utils.ts` version
- [ ] Canvas resize handle DOM duplicated across TextCard, FileCard, LinkCard, GroupCard
