# Deferred Risky Items

Items deemed too risky to fix during the review pass, ordered from highest to lowest priority.
These require architectural changes, new UI components, or large refactors that could introduce regressions.

---

## Priority 1: Security & Data Integrity

- [x] PDF export — replaced iframe/print with direct HTML file export via export-utils.ts
- [x] Asset protocol scope — narrowed from `"C:/**"` to `["$APPDATA/**", "$HOME/**"]` in tauri.conf.json
- [x] CSP — tightened to `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' asset: https://asset.localhost blob: data:; connect-src ipc: http://ipc.localhost`
- [x] Plugin settings RPC — added `'settings'` permission type and permission checks + key validation
- [x] Sandbox bootstrap `addSidebarPanel` — fixed API contract mismatch, implemented `ui.removeCommand`
- [x] Registry fetch — added `isValidRegistryPlugin()` runtime validation function
- [x] Canvas copy/paste — replaced module-level variable with navigator.clipboard API

## Priority 2: Performance & Scalability

- [x] Canvas `forceLayout` — moved to Web Worker (`src/workers/force-layout.worker.ts`)
- [x] Canvas `structuredClone` in `pushUndo` — replaced with shallow array copies in undo/redo
- [ ] Canvas dirty-rect tracking — separate static grid from dynamic layer (low priority, canvas performs well)
- [x] PdfViewer — added IntersectionObserver-based page virtualization
- [x] QuickOpen.tsx — moved `previewCache` to `useRef` (Task 8.9)
- [x] FileTreeItem — wrapped 5 modal components in conditional guards for lazy rendering

## Priority 3: Error Handling & Resilience

- [x] ErrorBoundary — added ErrorBoundary around CanvasView in EditorPane
- [x] Conflict resolution UX — added MergeConflictDialog with side-by-side diff view and Keep Mine/Keep Theirs resolution
- [x] `ensure_gitignore` — changed to return `Result` to propagate failure
- [x] `ui.removeCommand` — implemented via command-registry `unregister()` method
- [x] Import progress feedback — added `import://progress` events from all 3 importers + progress UI in ImportWizard

## Priority 4: Large Component Refactors

- [x] ExportModal.tsx — extracted `markdownToHtml`, `markdownToDocx`, `performBatchExport` into `src/lib/export-utils.ts`
- [x] GraphPanel.tsx — split into `GraphTypes.ts`, `GraphRenderer.ts`, `GraphMouseHandlers.ts`, `GraphSettingsPanel.tsx`
- [x] AppShell.tsx — extracted variables option-building into `src/hooks/use-variables-options.ts`

## Priority 5: i18n Gaps

- [x] FileConflictDialog — internationalized
- [x] OnboardingScreen — internationalized
- [x] FeatureWiki — internationalized
- [x] NewFileModal — internationalized
- [x] ListVariablesModal — internationalized
- [x] SetVariableModal — internationalized
- [x] ErrorBoundary — internationalized (using `i18next.t()` for class component)
- [ ] ToastContainer — hardcoded English (toast messages are generated at call sites, not in container)
- [x] WelcomeView `formatRelativeTime` — internationalized
- [x] SyncOptionsPage and SyncStatusIndicator — internationalized

## Priority 6: UX Improvements Requiring New UI

- [x] Canvas `prompt()` — replaced with in-app `CanvasInputModal` and `requestInput` callback
- [x] Canvas drag past edge — verified no boundary check exists; canvas already allows free movement
- [x] Canvas double-click empty space — auto-enter edit mode on new text node
- [x] Tag rename in TagPanel — added "Esc to cancel" hint
- [x] Modal z-index — added CSS variable scale (`--z-dropdown`, `--z-modal`, `--z-toast`, `--z-tooltip`, `--z-context-menu`) to theme.css

## Priority 7: Test Coverage

- [x] daily-notes.ts tests — added comprehensive unit tests with mocked Tauri/Zustand
- [x] Bear tag regex — made context-aware, skips code blocks and inline code spans

## Priority 8: Code Quality & Minor Items

- [x] `ImportResult` struct — deduplicated into `importer.rs`, imported by all three importers
- [x] `formatAgo` utility — extracted to `src/lib/format-utils.ts`, imported in both consumers
- [x] `unpushedCommits` — already uses revwalk count after reconnect; offline increment is best-effort
- [x] Canvas resize handle — extracted shared `ResizeHandles` component, used in TextCard, FileCard, LinkCard
- [x] Canvas `CanvasMinimap` `resolveCssVar` — deduplicated, now delegates to `canvas-utils.ts`
- [x] Tooltip keyframes — already defined in `index.css` (`tooltip-fade-in`, `tooltip-fade-out`)
- [x] `HEADING_STYLES` — added cross-reference comment linking helpers.ts and theme.ts
- [ ] SetVariableModal localStorage key constants — keys already defined as constants near usage; centralizing adds complexity for minimal benefit
- [x] QuickOpen `previewCache` — moved to `useRef` inside component
- [x] wiki-link-resolver cache — added `clearWikiLinkCache()` export for explicit invalidation
- [x] ContextMenu `onClose` — stabilized with `useRef` to prevent listener churn
- [ ] CSS inconsistency — light normalization pass deferred; inline styles needed for CSS variable values
- [x] `renderMarkdownPreview` — documented as intentional regex-based approach for performance
