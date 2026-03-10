# Area 7: Importers Review

## Files Reviewed
- `src-tauri/src/importer.rs` — Obsidian config reader
- `src-tauri/src/bear_importer.rs` — Bear app import
- `src-tauri/src/notion_importer.rs` — Notion import
- `src-tauri/src/roam_importer.rs` — Roam Research import

## Findings

### Bear Importer

- [x] Fixed: `sanitize_filename` did not truncate long filenames — added 200-char limit matching the Roam importer, preventing filesystem errors on notes with very long titles
- [x] Fixed: `copy_attachments_from_dir` silently swallowed all `fs::copy` errors via `let _ =` — now returns `Vec<String>` of error messages that are surfaced in `ImportResult.errors`
- [x] Fixed: `copy_attachment` (top-level attachments) also silently swallowed errors — now returns `Option<String>` error, propagated to `ImportResult.errors`
- [x] Fixed: `process_md_file` and `process_export_dir` updated to propagate attachment copy errors to the user through the result struct
- [ ] Deferred: `ImportResult` struct is duplicated identically in all three importer files — should be defined once in `importer.rs` and re-exported (added to deferred-risky-items.md)
- [ ] Deferred: Bear tag regex `#([^#\n]+)#` can false-match content inside code blocks or between unrelated `#` chars — needs context-aware parsing (added to deferred-risky-items.md)
- [ ] Deferred: No progress feedback during import — all importers run synchronously with no events emitted to the frontend (added to deferred-risky-items.md)

### Notion Importer

- [x] Fixed: `urlencoding_decode` only handled 5 hardcoded percent-encoded characters — replaced with a complete percent-decoding implementation that handles all valid `%XX` sequences and falls back gracefully on invalid UTF-8
- [x] Fixed: `ul` match arm contained dead code — lines 91-110 computed `out` via a direct-child `li` iteration, then unconditionally overwrote `out` with `format_list` at line 110; removed the dead path, now calls `format_list` directly
- [x] Fixed: Removed orphaned `li_content_to_markdown` function that was only referenced by the dead `ul` code path
- [x] Fixed: `<pre><code>` blocks did not extract language class — Notion exports code blocks with `class="language-xxx"` on the `<code>` element; now extracts and emits as fenced code block language hint (e.g., ` ```python `)
- [x] Fixed: Added `<s>`, `<del>`, `<strike>` tag handling — converts to `~~strikethrough~~` markdown syntax
- [x] Fixed: Added `<u>` tag handling — preserves as `<u>...</u>` HTML since markdown has no native underline
- [x] Fixed: Added `<input type="checkbox">` handling — Notion exports to-do items with checkbox inputs; now converts to `[ ]` / `[x]` markdown checkboxes

### Roam Importer

- [x] Fixed: `ms_to_iso` cast negative `i64` timestamps to `u64` via `secs as u64`, causing integer wrapping and panic on pre-epoch dates — now guards against negative timestamps and returns the epoch fallback string
- [x] Fixed: Frontmatter `title` field was emitted as bare YAML without quoting — titles containing `:`, `#`, `"`, `'`, newlines, or starting with `[`/`{` produced invalid YAML; now conditionally quotes and escapes

### Obsidian Config Reader (importer.rs)

- No bugs found. The config reader is well-structured with graceful fallback (returns `detected: false` if `.obsidian` dir is missing, silently skips unreadable config files).
- Note: Daily notes config is stored in the `hotkeys` HashMap which is semantically incorrect but functional — this is a minor code-smell, not a bug.

## Summary

| Metric | Count |
|--------|-------|
| Issues fixed | 11 |
| Items deferred | 3 |
| Files modified | 3 |
| Tests passing | 55/55 |
