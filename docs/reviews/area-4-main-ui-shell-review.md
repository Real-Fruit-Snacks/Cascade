# Area 4: Main UI Shell Review

## User Perspective
- [ ] [medium] SplitPaneContainer divider has no keyboard support — users cannot resize split panes without a mouse
- [ ] [medium] SearchModal replace-in-files has no undo/confirmation before vault-wide destructive replacements
- [ ] [medium] FileTreeItem renders InputModal, TemplatePicker, ConfirmDialog, MoveFileModal, and color picker for every tree item — perf overhead with hundreds of files
- [x] [medium] `matchesShortcut` in AppShell.tsx computes `meta` but voids it with `void meta` — Meta key is never validated
- [ ] [low] ContextMenu does not support Home/End keys for first/last item navigation (WAI-ARIA menu pattern)
- [ ] [low] Tag rename in TagPanel commits on blur — no visible cancel affordance besides Escape

## Developer Perspective
- [ ] [medium] AppShell.tsx is 740+ lines with 20+ state vars and 10+ useEffect hooks — variables option-building duplicated 7 times
- [ ] [medium] Multiple useEffect hooks in AppShell.tsx have empty deps `[]` but reference `t` — stale translations if language changes at runtime
- [ ] [medium] GraphPanel.tsx is ~900 lines combining simulation, canvas rendering, settings UI, mouse handling — fragile ref dependencies
- [ ] [medium] StatusBar `sharedEditorSub` module-level singleton never cleans up `timerId`/`rafId` if `detach()` is called between scheduling and execution
- [x] [medium] `handleKeyDown` in AppShell.tsx iterates all commands on every keypress via `commandRegistry.getAll()` — O(n) per keystroke with no early-exit for non-modifier keys
- [ ] [low] QuickOpen `previewCache` is module-level Map that persists across mount/unmount — stale entries possible
- [ ] [low] wiki-link-resolver cache uses referential equality — works only because store replaces array on each update
- [ ] [low] ContextMenu `onClose` in useEffect deps causes listener churn if parent doesn't memoize
- [ ] [nitpick] CSS approach inconsistent — mix of Tailwind utility classes and inline style objects

## Status: Complete
