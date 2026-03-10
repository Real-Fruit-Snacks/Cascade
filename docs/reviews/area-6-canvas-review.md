# Area 6: Canvas Review

## User Perspective
- [x] [medium] Keyboard zoom (Ctrl+=/Ctrl+-) does not anchor to screen center — now computes world-space center point
- [x] [medium] Shift+Arrow nudge direction is inverted — swapped to Shift=20px, plain=1px
- [ ] [deferred] `prompt()` used for link URLs and edge labels — poor UX for desktop app, should use in-app modal
- [ ] [deferred] Dragging node past canvas edge cancels drag immediately — node left at intermediate position
- [ ] [deferred] Copy/paste uses module-level variable instead of system clipboard — can't copy between canvas files
- [ ] [deferred] Double-clicking empty canvas to create text node doesn't auto-enter edit mode

## Developer Perspective
- [x] [critical] `CanvasBackground` calls `getComputedStyle(document.documentElement)` on every render — forces style recalculation per node/edge, significant perf bottleneck
- [x] [medium] `onCardMouseDown` calls `pushUndo()` unconditionally — deferred to first actual pixel of movement
- [ ] [deferred] `structuredClone` in `pushUndo` deep-clones entire state on every mutation — expensive with many nodes
- [ ] [deferred] `forceLayout` runs O(n²) repulsion × 50 iterations on main thread — freezes UI with >100 nodes
- [ ] [deferred] `CanvasBackground` re-renders entire canvas on any node/edge/selection change — no dirty-rect tracking
- [x] [medium] `fitNodeToContent` triggers 3 `updateNode` calls each pushing undo — now single undo via skipUndo param
- [x] [medium] `LinkCard` double-click opens URL without scheme validation — `javascript:` URLs possible from malicious .canvas files
- [x] [low] `escapeXml` in CanvasExport.ts doesn't escape single quotes — potential malformed SVG
- [ ] [deferred] Resize handle DOM duplicated across TextCard, FileCard, LinkCard, GroupCard
- [ ] [deferred] `CanvasMinimap` has duplicate `resolveCssVar` helper differing from `canvas-utils.ts` version

## Status: Complete
