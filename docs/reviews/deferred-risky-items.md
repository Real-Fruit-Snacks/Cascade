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
