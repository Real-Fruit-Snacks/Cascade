# Area 6: Canvas Review

## User Perspective
- [ ] [medium] Keyboard zoom (Ctrl+=/Ctrl+-) does not anchor to screen center — view drifts unpredictably
- [ ] [medium] Shift+Arrow nudge direction is inverted — Shift = 1px (fine), plain = 20px (coarse), opposite to convention
- [ ] [medium] `prompt()` used for link URLs and edge labels — poor UX for desktop app, should use in-app modal
- [ ] [low] Dragging node past canvas edge cancels drag immediately — node left at intermediate position
- [ ] [low] Copy/paste uses module-level variable instead of system clipboard — can't copy between canvas files
- [ ] [low] Double-clicking empty canvas to create text node doesn't auto-enter edit mode

## Developer Perspective
- [x] [critical] `CanvasBackground` calls `getComputedStyle(document.documentElement)` on every render — forces style recalculation per node/edge, significant perf bottleneck
- [ ] [medium] `onCardMouseDown` calls `pushUndo()` unconditionally when starting move drag — pushes no-op undo entry for click-to-select
- [ ] [medium] `structuredClone` in `pushUndo` deep-clones entire state on every mutation — expensive with many nodes
- [ ] [medium] `forceLayout` runs O(n²) repulsion × 50 iterations on main thread — freezes UI with >100 nodes
- [ ] [medium] `CanvasBackground` re-renders entire canvas on any node/edge/selection change — no dirty-rect tracking
- [ ] [medium] `fitNodeToContent` triggers 3 `updateNode` calls each pushing undo — should batch or bypass intermediate undo
- [x] [medium] `LinkCard` double-click opens URL without scheme validation — `javascript:` URLs possible from malicious .canvas files
- [x] [low] `escapeXml` in CanvasExport.ts doesn't escape single quotes — potential malformed SVG
- [ ] [low] Resize handle DOM duplicated across TextCard, FileCard, LinkCard, GroupCard
- [ ] [nitpick] `CanvasMinimap` has duplicate `resolveCssVar` helper differing from `canvas-utils.ts` version

## Status: Complete
