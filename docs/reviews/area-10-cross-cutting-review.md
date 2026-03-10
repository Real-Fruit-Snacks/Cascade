# Area 10: Cross-Cutting Concerns Review

## Findings

### Error Handling
- [x] Fixed: ErrorBoundary default fallback now has `role="alert"` and `aria-live="assertive"` for screen reader announcement
- [ ] Deferred: ErrorBoundary hardcoded English strings ("Something went wrong", "Try Again") — requires i18n integration in class component (added to deferred-risky-items.md)
- [x] Verified: Backend error types in `error.rs` are well-structured with proper `Display`, `Error`, and `From` impls; errors convert cleanly to `InvokeError` for IPC
- [x] Verified: Frontend IPC wrappers in `tauri-commands.ts` correctly propagate Promise rejections — callers handle errors via try/catch or `.catch()`
- [x] Verified: `daily-notes.ts` uses defensive try/catch for folder creation, clipboard access, and template loading — graceful degradation on failure

### i18n
- [x] Fixed: Populated empty `errors.json` with 15 error message keys matching backend error types (notADirectory, pathTraversal, ioError, invalidPath, etc.)
- [x] Verified: i18n setup in `src/i18n/index.ts` correctly loads all 13 namespaces with fallback to English
- [x] Verified: `html lang` attribute is dynamically updated on language change via `i18n.on('languageChanged')` listener
- [ ] Deferred: ErrorBoundary, ToastContainer, and several other components use hardcoded English (already tracked in deferred-risky-items.md)

### Accessibility
- [x] Fixed: ErrorBoundary error state container now uses `role="alert"` and `aria-live="assertive"` so screen readers announce errors immediately
- [ ] Deferred: No `role="alert"` on toast notifications — requires ToastContainer refactor (already in deferred-risky-items.md)
- [x] Verified: `index.html` has `lang="en"` attribute set correctly
- [x] Verified: Command palette, quick open, and export dialogs all have `ariaLabel` keys in i18n files

### Performance
- [x] Verified: `tidemark.ts` `findVariables` has a 50ms deadline guard to prevent regex runaway on large documents
- [x] Verified: `wiki-link-resolver.ts` uses pre-built `Set`/`Map` indexes for O(1) resolution instead of O(n) scans
- [x] Verified: `vault.rs` `open_vault` uses `spawn_blocking` to offload tree building from the async runtime

### Security
- [x] Verified: CSP policy restricts `script-src` to `'self'`, `default-src` to `'self'`, and `connect-src` to `ipc:` and `http://ipc.localhost`
- [x] Verified: `validate_path_canonical` in `vault.rs` prevents path traversal via `..`, null bytes, and symlinks; all file operations go through this check
- [x] Verified: Plugin zip extraction in `extract_plugin_zip` rejects `..` paths and absolute paths in zip entries
- [x] Verified: Plugin ID and theme filename validation restricts to alphanumeric, hyphens, and underscores only
- [x] Verified: Export commands validate file extensions (only `.html`, `.md`, `.docx`, `.zip`) and verify parent directory exists
- [x] Verified: Dictionary writes enforce max word count (10,000), max word length (100), and character whitelist
- [ ] Deferred: Asset protocol scope includes `"C:/**"` and `"D:/**"` — overly broad, but required for Tauri asset loading from arbitrary vault paths (added to deferred-risky-items.md)
- [ ] Deferred: `style-src 'unsafe-inline'` in CSP — required for Tailwind/runtime styles but weakens style injection protection (added to deferred-risky-items.md)

### Test Coverage
- [x] Fixed: Added `path-utils.test.ts` — 6 tests covering filename extraction, directory parsing, backslash normalization, and edge cases
- [x] Fixed: Added `tag-utils.test.ts` — 10 tests covering inline tag extraction, frontmatter tags (inline and list format), deduplication, and edge cases
- [x] Fixed: Added `wiki-link-resolver.test.ts` — 14 tests covering `parseWikiTarget` (headings, block IDs) and `resolveWikiLink` (exact, case-insensitive, basename, canvas, backslash normalization)
- [x] Fixed: Added 2 new tests to `toc.test.ts` for slugify edge cases (leading/trailing hyphens, special-character-only headings)
- [x] Verified: Existing tests for `fuzzy-match`, `template-utils`, `tidemark`, `command-registry`, and `toc` are thorough with good edge case coverage
- [ ] Deferred: No tests for `daily-notes.ts` — requires mocking Tauri IPC, Zustand stores, and navigator.clipboard (added to deferred-risky-items.md)

### CSS/Styling — Catppuccin Theme Consistency
- [x] Verified: `tailwind.config.js` maps all 26 Catppuccin color tokens to CSS custom properties
- [x] Verified: ErrorBoundary uses `var(--ctp-*)` CSS variables consistently
- [x] Verified: `tauri.conf.json` sets `backgroundColor` to `#1e1e2e` (Catppuccin Mocha base)
- [x] Verified: Font families defined as Inter (sans) and JetBrains Mono (mono)

### Code Quality
- [x] Fixed: `toc.ts` `slugify` now strips leading/trailing hyphens with `replace(/^-+|-+$/g, '')` instead of `.trim()` which only removes whitespace — fixes slugs like `## !Hello!` producing `-hello-` instead of `hello`
- [x] Verified: `template-utils.ts` correctly resets `pluginRe.lastIndex` after `.test()` to prevent skipping matches
- [x] Verified: `tsconfig.json` has strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`
- [x] Verified: TypeScript types in `src/types/index.ts` are minimal and well-typed; IPC command types in `tauri-commands.ts` match Rust structs

## Summary

| Category | Fixed | Verified | Deferred |
|----------|-------|----------|----------|
| Error Handling | 1 | 3 | 1 |
| i18n | 1 | 2 | 1 |
| Accessibility | 1 | 2 | 1 |
| Performance | 0 | 3 | 0 |
| Security | 0 | 6 | 2 |
| Test Coverage | 4 | 1 | 1 |
| CSS/Styling | 0 | 4 | 0 |
| Code Quality | 1 | 3 | 0 |
| **Total** | **8** | **24** | **6** |

## Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npm run lint` — passes (only pre-existing warnings unrelated to this review)
- `npm test` — 176 tests pass across 8 test files (3 new test files, 2 new tests added to existing file)
