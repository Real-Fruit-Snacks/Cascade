# Area 3: Stores & State Management Review

## User Perspective
- [ ] [low] `setTimeout(100)` delays for scroll-to-heading/block after file open are fragile — may fail on slow systems or large files

## Developer Perspective
- [x] [medium] `FILE_SIZE_LIMIT` (5MB) is duplicated as local `const` in both `openFile` (line 307) and `openFileInPane` (line 723) in editor-store.ts — should be module-level
- [ ] [medium] `saveFile` and `savePaneFile` in editor-store.ts duplicate ~20 lines of save logic (TOC update, write, dirty tracking, index updates) — candidate for extraction
- [ ] [low] `setInterval(saveDrafts, 5000)` runs unconditionally even when no tabs are dirty — minor perf overhead
- [ ] [nitpick] `enablePlugin` and `disablePlugin` in plugin-store.ts are marked `async` but contain no `await` — misleading signature

## Status: Complete
