# Comprehensive Application Review — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Systematically review every aspect of Cascade from user and developer perspectives, fixing all issues area by area.

**Architecture:** 10 sequential review passes, each covering a feature area end-to-end. Each pass: read all files → audit UX + code quality → write findings checklist → fix all items → verify → mark complete.

**Tech Stack:** Tauri v2 (Rust), React 19, TypeScript, CodeMirror 6, Zustand 5, Tailwind CSS

---

## Review Process Per Area

For every area below, follow these steps exactly:

1. **Read** every file listed
2. **Audit (User)** — look/feel, smoothness, usefulness, edge cases, error states, accessibility, visual consistency
3. **Audit (Developer)** — bugs, type safety, error handling, performance, dead code, refactors, test coverage, architecture
4. **Write checklist** — save to `docs/reviews/area-N-<name>-review.md` using the template below
5. **Fix all items** — work through checklist, check off each item as fixed
6. **Verify** — run `cargo check`, `npx tsc --noEmit`, `npm run lint`, `npm test` as appropriate
7. **Update status** — mark checklist as Complete
8. **Commit** — `git add . && git commit -m "review: complete area N - <name>"`

### Checklist Template

```markdown
# Area N: <Name> Review

## User Perspective
- [ ] [critical/medium/low/nitpick] Description

## Developer Perspective
- [ ] [critical/medium/low/nitpick] Description

## Status: In Progress
```

---

### Task 1: Core Backend (Rust)

**Files to review:**
- `src-tauri/src/vault.rs` — vault operations (create, read, write, delete, rename, move)
- `src-tauri/src/watcher.rs` — file system watching with notify-debouncer
- `src-tauri/src/search.rs` — search implementation
- `src-tauri/src/fts.rs` — full-text search with SQLite
- `src-tauri/src/indexer.rs` — file indexing
- `src-tauri/src/query.rs` — query parsing/execution
- `src-tauri/src/error.rs` — CascadeError enum
- `src-tauri/src/types.rs` — shared Rust types
- `src-tauri/src/lib.rs` — Tauri command registration
- `src-tauri/src/main.rs` — app entry point
- `src-tauri/Cargo.toml` — dependencies

**User perspective focus:**
- File operations reliable? (create, save, rename, delete)
- Search fast and accurate?
- File watcher responsive? Does it catch external changes?
- Error messages helpful to end users?

**Developer perspective focus:**
- Path traversal security (`validate_path`)
- Error handling completeness (unwrap vs proper error propagation)
- Resource cleanup (file handles, DB connections, watcher lifecycle)
- Concurrency safety (Mutex usage, deadlock potential)
- Dead code, unused imports
- Test coverage for edge cases

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-1-core-backend-review.md`
**Step 3:** Fix all items, checking off each
**Step 4:** Run `cd src-tauri && cargo check && cargo test`
**Step 5:** Commit: `git commit -m "review: complete area 1 - core backend"`

---

### Task 2: Editor Engine (CodeMirror 6)

**Files to review:**
- `src/editor/use-codemirror.ts` — main CM6 hook, extension setup
- `src/editor/build-extensions.ts` — extension builder
- `src/editor/live-preview/` — all 7 files (index, plugin, build-decorations, helpers, types, theme, widgets)
- `src/editor/wiki-links.ts` — wiki-link decorations and click handling
- `src/editor/wiki-link-completion.ts` — `[[` completion
- `src/editor/tags.ts` — tag decorations, click handler, autocompletion
- `src/editor/image-preview.ts` — inline image rendering
- `src/editor/image-controls.ts` — image resize/controls
- `src/editor/math-preview.ts` — KaTeX math rendering
- `src/editor/mermaid-preview.ts` — mermaid diagram rendering
- `src/editor/callout-preview.ts` — callout block rendering
- `src/editor/query-preview.ts` — dataview-style query rendering
- `src/editor/query-parser.ts` — query language parser
- `src/editor/footnote-preview.ts` — footnote rendering
- `src/editor/table-editor.ts` — markdown table editing
- `src/editor/formatting-commands.ts` — bold, italic, etc.
- `src/editor/smart-lists.ts` — auto-continue lists
- `src/editor/properties-widget.ts` — YAML frontmatter widget
- `src/editor/highlight-syntax.ts` — syntax highlighting
- `src/editor/catppuccin-theme.ts` — theme colors
- `src/editor/search-theme.ts` — search panel styling
- `src/editor/search-in-selection.ts` — search within selection
- `src/editor/tidemark-highlight.ts` — heading emphasis
- `src/editor/typewriter-mode.ts` — cursor centering
- `src/editor/cursor-line.ts` — active line tracking
- `src/editor/indent-guides.ts` — indentation guides
- `src/editor/drop-handler.ts` — drag-and-drop files
- `src/editor/custom-spellcheck.ts` — spellcheck integration
- `src/editor/spellcheck-engine.ts` — spellcheck logic

**User perspective focus:**
- Live preview renders correctly for all markdown elements?
- Wiki-link navigation smooth?
- Image preview/resize works?
- Math/mermaid/callout rendering accurate?
- Table editing intuitive?
- Formatting shortcuts work?
- Search UX smooth?
- Performance with large documents?

**Developer perspective focus:**
- CM6 ViewPlugin lifecycle (create/update/destroy)
- Decoration positioning (stale decorations after edits?)
- Memory leaks (event listeners, timers not cleaned up)
- "Reveal on cursor" pattern implemented correctly?
- Extension compartment reconfiguration
- Dead code from past refactors

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-2-editor-engine-review.md`
**Step 3:** Fix all items
**Step 4:** Run `npx tsc --noEmit && npm run lint && npm test`
**Step 5:** Commit: `git commit -m "review: complete area 2 - editor engine"`

---

### Task 3: Stores & State (Zustand)

**Files to review:**
- `src/stores/vault-store.ts` — vault/file tree state
- `src/stores/editor-store.ts` — editor/tab state
- `src/stores/settings-store.ts` — user settings
- `src/stores/canvas-store.ts` — canvas state
- `src/stores/sync-store.ts` — git sync state
- `src/stores/plugin-store.ts` — plugin state
- `src/stores/toast-store.ts` — notification toasts

**User perspective focus:**
- State persists correctly across app restarts?
- Settings changes apply immediately?
- Tab state preserved?
- No stale state after file operations?

**Developer perspective focus:**
- Selective subscriptions (no unnecessary re-renders)
- Store action correctness (immutable updates?)
- Race conditions in async actions
- Store initialization order dependencies
- Circular dependencies between stores
- Dead state fields

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-3-stores-state-review.md`
**Step 3:** Fix all items
**Step 4:** Run `npx tsc --noEmit && npm run lint && npm test`
**Step 5:** Commit: `git commit -m "review: complete area 3 - stores and state"`

---

### Task 4: Main UI Shell

**Files to review:**
- `src/components/AppShell.tsx` — main app layout
- `src/components/TitleBar.tsx` — custom frameless title bar
- `src/components/StatusBar.tsx` — bottom status bar
- `src/components/EditorPane.tsx` — editor container
- `src/components/SplitPaneContainer.tsx` — split view
- `src/components/CommandPalette.tsx` — command palette
- `src/components/QuickOpen.tsx` — quick file open
- `src/components/SearchModal.tsx` — global search
- `src/components/sidebar/Sidebar.tsx` — sidebar container
- `src/components/sidebar/VaultExplorer.tsx` — file tree
- `src/components/sidebar/FileTreeItem.tsx` — file tree items
- `src/components/sidebar/ContextMenu.tsx` — right-click menu
- `src/components/sidebar/OutlinePanel.tsx` — document outline
- `src/components/sidebar/BacklinksPanel.tsx` — backlinks
- `src/components/sidebar/BookmarksPanel.tsx` — bookmarks
- `src/components/sidebar/TagPanel.tsx` — tags browser
- `src/components/sidebar/GraphPanel.tsx` — graph view
- `src/components/sidebar/InputModal.tsx` — rename/new file input
- `src/components/sidebar/MoveFileModal.tsx` — move file dialog
- `src/components/sidebar/TemplatePicker.tsx` — template selection
- `src/components/sidebar/VaultPicker.tsx` — vault switcher
- `src/hooks/use-commands.ts` — command hook
- `src/hooks/use-fs-watcher.ts` — file watcher hook
- `src/hooks/use-close-animation.ts` — modal close animation
- `src/hooks/use-focus-trap.ts` — focus trap hook
- `src/lib/command-registry.ts` — command system
- `src/lib/fuzzy-match.ts` — fuzzy matching
- `src/lib/quick-open-bus.ts` — quick open event bus
- `src/lib/path-utils.ts` — path utilities
- `src/lib/tag-utils.ts` — tag utilities
- `src/lib/wiki-link-resolver.ts` — wiki-link resolution

**User perspective focus:**
- Title bar buttons work (minimize, maximize, close)?
- Sidebar resize smooth? Panels switch cleanly?
- File tree: expand/collapse, drag-drop, context menu all work?
- Command palette responsive? Fuzzy matching accurate?
- Quick open fast with many files?
- Search results accurate and navigable?
- Split pane: create, resize, close panes?
- Keyboard navigation throughout?

**Developer perspective focus:**
- Component size (any components too large to maintain?)
- Prop drilling vs store usage
- Event handler cleanup
- Render performance (unnecessary re-renders?)
- Accessibility (ARIA labels, keyboard nav, focus management)
- CSS consistency (Tailwind classes vs inline styles)

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-4-main-ui-shell-review.md`
**Step 3:** Fix all items
**Step 4:** Run `npx tsc --noEmit && npm run lint && npm test`
**Step 5:** Commit: `git commit -m "review: complete area 4 - main UI shell"`

---

### Task 5: Feature UIs

**Files to review:**
- `src/components/SettingsModal.tsx` — settings interface
- `src/components/ExportModal.tsx` — export (PDF, HTML, DOCX, etc.)
- `src/components/ImportWizard.tsx` — import from other apps
- `src/components/FeatureWiki.tsx` — feature documentation
- `src/components/WelcomeView.tsx` — welcome/empty state
- `src/components/OnboardingScreen.tsx` — first-run onboarding
- `src/components/AboutDialog.tsx` — about dialog
- `src/components/ConfirmDialog.tsx` — confirmation dialogs
- `src/components/FileConflictDialog.tsx` — conflict resolution
- `src/components/FilePropertiesDialog.tsx` — file properties
- `src/components/ImageViewer.tsx` — image viewer
- `src/components/PdfViewer.tsx` — PDF viewer
- `src/components/ListVariablesModal.tsx` — variables list
- `src/components/SetVariableModal.tsx` — set variable
- `src/components/NewFileModal.tsx` — new file dialog
- `src/components/ToastContainer.tsx` — toast notifications
- `src/components/Tooltip.tsx` — tooltip component
- `src/components/Skeleton.tsx` — loading skeleton
- `src/components/ErrorBoundary.tsx` — error boundary

**User perspective focus:**
- Settings organized logically? Changes save?
- Export produces valid output for each format?
- Import wizard clear and reliable?
- Onboarding helpful for new users?
- Dialogs feel polished (animations, focus, escape to close)?
- Error states handled gracefully?

**Developer perspective focus:**
- Modal/dialog patterns consistent?
- Form validation
- Error boundary coverage
- Component reusability
- i18n coverage (all strings translated?)

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-5-feature-uis-review.md`
**Step 3:** Fix all items
**Step 4:** Run `npx tsc --noEmit && npm run lint && npm test`
**Step 5:** Commit: `git commit -m "review: complete area 5 - feature UIs"`

---

### Task 6: Canvas

**Files to review:**
- `src/stores/canvas-store.ts` — canvas state and actions
- `src/components/canvas/CanvasView.tsx` — main canvas component
- `src/components/canvas/CanvasBackground.tsx` — grid/background
- `src/components/canvas/CanvasCards.tsx` — card rendering
- `src/components/canvas/CanvasToolbar.tsx` — toolbar
- `src/components/canvas/CanvasContextMenu.tsx` — right-click menu
- `src/components/canvas/CanvasMinimap.tsx` — minimap
- `src/components/canvas/CanvasSearch.tsx` — canvas search
- `src/components/canvas/CanvasExport.tsx` — export canvas
- `src/components/canvas/CanvasAutoLayout.ts` — auto-layout algorithms
- `src/components/canvas/canvas-fit-to-content.ts` — fit cards to content
- `src/components/canvas/canvas-utils.ts` — canvas utilities
- `src/components/canvas/cards/` — card type components
- `src/types/canvas.ts` — canvas types

**User perspective focus:**
- Pan/zoom smooth?
- Card creation, editing, deletion intuitive?
- Connections between cards work?
- Drag/resize cards responsive?
- Minimap useful and accurate?
- Auto-layout produces good results?
- Large canvases perform well?

**Developer perspective focus:**
- Canvas store complexity (is it maintainable?)
- Undo/redo correctness
- Hit testing accuracy
- Rendering performance (virtualization for large canvases?)
- State serialization/deserialization

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-6-canvas-review.md`
**Step 3:** Fix all items
**Step 4:** Run `npx tsc --noEmit && npm run lint && npm test`
**Step 5:** Commit: `git commit -m "review: complete area 6 - canvas"`

---

### Task 7: Importers

**Files to review:**
- `src-tauri/src/importer.rs` — base importer traits/types
- `src-tauri/src/bear_importer.rs` — Bear app import
- `src-tauri/src/notion_importer.rs` — Notion import
- `src-tauri/src/roam_importer.rs` — Roam Research import

**User perspective focus:**
- Import produces valid markdown?
- Attachments/images handled?
- Progress feedback during import?
- Error messages clear if import fails?
- Folder structure preserved?

**Developer perspective focus:**
- HTML-to-markdown conversion quality
- Edge cases (empty notes, special characters, deeply nested structures)
- Error handling (partial failures)
- Resource cleanup

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-7-importers-review.md`
**Step 3:** Fix all items
**Step 4:** Run `cd src-tauri && cargo check && cargo test`
**Step 5:** Commit: `git commit -m "review: complete area 7 - importers"`

---

### Task 8: Plugin System

**Files to review:**
- `src/plugin-api/index.ts` — plugin API entry
- `src/plugin-api/sandbox.ts` — iframe sandbox execution
- `src/plugin-api/types.ts` — plugin API types
- `src/stores/plugin-store.ts` — plugin state
- `src/lib/plugin-registry.ts` — plugin registration

**User perspective focus:**
- Can plugins be installed/enabled/disabled?
- Plugin errors don't crash the app?
- Plugin UI integrates cleanly?

**Developer perspective focus:**
- Sandbox security (CSP, postMessage validation, origin checks)
- API surface completeness
- Permission enforcement
- Memory/resource cleanup when plugins unload
- Type safety of RPC bridge

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-8-plugin-system-review.md`
**Step 3:** Fix all items
**Step 4:** Run `npx tsc --noEmit && npm run lint`
**Step 5:** Commit: `git commit -m "review: complete area 8 - plugin system"`

---

### Task 9: Git Sync

**Files to review:**
- `src-tauri/src/git.rs` — git operations backend
- `src/stores/sync-store.ts` — sync state
- `src/components/SyncStatusIndicator.tsx` — sync UI
- `src/hooks/use-sync-timer.ts` — auto-sync timer
- `src/components/SettingsModal.tsx` (sync settings section)

**User perspective focus:**
- Sync status clear and accurate?
- Conflict handling understandable?
- Auto-sync interval configurable?
- Credential storage secure?
- Error messages actionable?

**Developer perspective focus:**
- Git operations error handling (network failures, auth failures, merge conflicts)
- Credential security (keyring usage)
- Sync race conditions
- Status state machine correctness

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-9-git-sync-review.md`
**Step 3:** Fix all items
**Step 4:** Run `cd src-tauri && cargo check` and `npx tsc --noEmit && npm run lint`
**Step 5:** Commit: `git commit -m "review: complete area 9 - git sync"`

---

### Task 10: Cross-Cutting Concerns

**Files to review:**
- `src-tauri/src/error.rs` — error types
- `src/components/ErrorBoundary.tsx` — React error boundary
- `src/locales/en/` — all i18n translation files
- `src-tauri/tauri.conf.json` — CSP and security config
- `src/types/index.ts` — shared TypeScript types
- `src/lib/tauri-commands.ts` — IPC wrappers
- `src/lib/daily-notes.ts` — daily notes
- `src/lib/template-utils.ts` — templates
- `src/lib/tidemark.ts` — tidemark utility
- `src/lib/toc.ts` — table of contents generation
- All test files: `src/**/*.test.ts`
- `tailwind.config.js` — Tailwind configuration
- `tsconfig.json` — TypeScript configuration
- `index.html` — app entry point

**Focus areas:**
- **Error handling:** consistent pattern across frontend and backend?
- **i18n:** all user-facing strings translated? Missing keys?
- **Accessibility:** keyboard navigation, screen reader support, ARIA attributes, color contrast
- **Performance:** bundle size, lazy loading, unnecessary re-renders, large list virtualization
- **Security:** CSP policy, path validation, IPC input validation, XSS prevention
- **Test coverage:** missing tests for critical paths?
- **CSS/styling:** Catppuccin theme consistency, dark/light mode, responsive layout

**Step 1:** Read all listed files
**Step 2:** Write findings to `docs/reviews/area-10-cross-cutting-review.md`
**Step 3:** Fix all items
**Step 4:** Run full verification: `cd src-tauri && cargo check && cargo test && cd .. && npx tsc --noEmit && npm run lint && npm test`
**Step 5:** Commit: `git commit -m "review: complete area 10 - cross-cutting concerns"`

---

## Final Verification

After all 10 areas are complete:

1. Run full build: `npm run tauri build`
2. Review all checklist files — confirm every item is checked off
3. Create summary: `docs/reviews/review-summary.md` with stats (total findings, by severity, by area)
4. Final commit: `git commit -m "review: complete comprehensive application review"`
