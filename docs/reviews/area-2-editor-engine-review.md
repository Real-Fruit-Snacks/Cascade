# Area 2: Editor Engine (CodeMirror 6) Review

## User Perspective
- [x] [low] Callout header widget doesn't render the icon — only the title text shows (icon param unused in `CalloutHeaderWidget.toDOM`)
- [ ] [deferred] Table cells don't render inline markdown (bold, links, etc.) — shows raw markdown syntax

## Developer Perspective
- [x] [medium] `CalloutHeaderWidget.toDOM` (widgets.ts) receives `icon` in constructor but never creates the icon DOM element — icon is silently dropped
- [x] [medium] `TableWidget.eq` (widgets.ts) doesn't compare `alignments` array — stale alignment rendering when only column alignment changes
- [x] [medium] `ImageWidget.eq` (widgets.ts) doesn't compare `alt` or `rawUrl` — stale alt text after editing image markdown
- [x] [low] `parseTableRow` (helpers.ts) doesn't handle escaped pipes `\|` in cell content — splits incorrectly on escaped pipes
- [x] [low] `cursorOnLines` in `helpers.ts` computes cursor line from `state.selection.main.head` instead of using the shared `cursorLineField` — inconsistent with cursor-line pattern used elsewhere
- [ ] [deferred] `HEADING_STYLES` in helpers.ts duplicates heading size/color values from `theme.ts` — potential drift between transclusion preview and editor rendering
- [ ] [deferred] `renderMarkdownPreview` uses regex-based markdown parsing — fragile for edge cases but acceptable for transclusion previews

## Status: Complete
