# Area 4: Main UI Shell Review

## User Perspective
- [x] [medium] SplitPaneContainer divider has no keyboard support — added keyboard handler with arrow keys and Shift for step size
- [x] [medium] SearchModal replace-in-files has no undo/confirmation before vault-wide destructive replacements — added window.confirm
- [ ] [deferred] FileTreeItem renders InputModal, TemplatePicker, ConfirmDialog, MoveFileModal, and color picker for every tree item — perf overhead with hundreds of files
- [x] [medium] `matchesShortcut` in AppShell.tsx computes `meta` but voids it with `void meta` — Meta key is never validated
- [x] [low] ContextMenu does not support Home/End keys for first/last item navigation — added Home/End handler
- [ ] [deferred] Tag rename in TagPanel commits on blur — no visible cancel affordance besides Escape

## Developer Perspective
- [ ] [deferred] AppShell.tsx is 740+ lines with 20+ state vars and 10+ useEffect hooks — variables option-building duplicated 7 times
- [x] [medium] Multiple useEffect hooks in AppShell.tsx have empty deps `[]` but reference `t` — added `t` to 7 dependency arrays
- [ ] [deferred] GraphPanel.tsx is ~900 lines combining simulation, canvas rendering, settings UI, mouse handling — fragile ref dependencies
- [x] [medium] StatusBar `sharedEditorSub` module-level singleton never cleans up `timerId`/`rafId` — reset IDs to 0 in detach()
- [x] [medium] `handleKeyDown` in AppShell.tsx iterates all commands on every keypress via `commandRegistry.getAll()` — O(n) per keystroke with no early-exit for non-modifier keys
- [ ] [deferred] QuickOpen `previewCache` is module-level Map that persists across mount/unmount — stale entries possible
- [ ] [deferred] wiki-link-resolver cache uses referential equality — works only because store replaces array on each update
- [ ] [deferred] ContextMenu `onClose` in useEffect deps causes listener churn if parent doesn't memoize
- [ ] [deferred] CSS approach inconsistent — mix of Tailwind utility classes and inline style objects

## Status: Complete
