# Area 3: Stores & State Management Review

## User Perspective
- [ ] [deferred] `setTimeout(100)` delays for scroll-to-heading/block after file open are fragile — may fail on slow systems or large files

## Developer Perspective
- [x] [medium] `FILE_SIZE_LIMIT` (5MB) is duplicated as local `const` in both `openFile` (line 307) and `openFileInPane` (line 723) in editor-store.ts — should be module-level
- [x] [medium] `saveFile` and `savePaneFile` in editor-store.ts duplicate ~20 lines of save logic — extracted `performSave` helper
- [x] [low] `setInterval(saveDrafts, 5000)` runs unconditionally even when no tabs are dirty — added early-exit guard
- [x] [nitpick] `enablePlugin` in plugin-store.ts marked `async` but contains no `await` — removed async keyword

## Status: Complete
