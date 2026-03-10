# Comprehensive Application Review Design

## Goal

Systematic review of the entire Cascade application from both user and developer perspectives, working through one feature area at a time. Fix all issues before moving to the next area.

## Dual Lens

**User perspective**: look, feel, smoothness, usefulness, edge cases, error states, accessibility, visual consistency.

**Developer perspective**: bugs, type safety, error handling, performance, dead code, refactor opportunities, test coverage gaps, architecture.

## Process Per Area

1. Read all relevant files (code, tests, types, styles)
2. User perspective audit
3. Developer perspective audit
4. Present findings organized by severity (critical / medium / low / nitpick)
5. Write checklist to `docs/reviews/area-N-<name>-review.md`
6. Fix all items, checking off each
7. Verify fixes, mark checklist complete
8. Move to next area

## Review Areas (in order)

1. **Core backend** - Rust: vault.rs, watcher.rs, search.rs, fts.rs, indexer.rs, error.rs, types.rs
2. **Editor engine** - CM6 setup, live preview, wiki-links, tags, image preview, math, mermaid, callouts, tables, formatting
3. **Stores & state** - vault-store, editor-store, settings-store, canvas-store, sync-store, plugin-store, toast-store
4. **Main UI shell** - AppShell, TitleBar, StatusBar, sidebar/FileTree, CommandPalette, QuickOpen, SearchModal
5. **Feature UIs** - SettingsModal, ExportModal, ImportWizard, FeatureWiki, WelcomeView, OnboardingScreen
6. **Canvas** - canvas-store + all canvas components
7. **Importers** - bear, notion, roam importers
8. **Plugin system** - plugin-store, sandbox, plugin API
9. **Git sync** - git.rs + sync-store + SyncStatusIndicator
10. **Cross-cutting** - error handling, i18n, accessibility, performance, security

## Checklist Template

```markdown
# Area N: <Name> Review

## User Perspective
- [ ] [severity] Finding description

## Developer Perspective
- [ ] [severity] Finding description

## Status: In Progress / Complete
```

## Scope

~150 files across frontend (React/TypeScript/CM6) and backend (Rust/Tauri).
