# Changelog

All notable changes to Cascade will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.3] — 2026-03-25

### Security

- **Collab server binds to localhost** — WebSocket relay now binds to `127.0.0.1` instead of `0.0.0.0`, preventing LAN exposure. Minimum 8-character password enforced.
- **Path traversal hardened** — Fixed traversal vulnerabilities in trash restore/delete, file history listing, and git commands. All vault operations now validate against canonical paths.
- **Zip Slip protection** — Notion importer and plugin extraction now use `enclosed_name()` and `starts_with()` checks to prevent malicious zip entries escaping their target directory.
- **XSS mitigations** — `escapeHtml` now escapes quotes (`"`, `'`); mermaid SVG rendered via `DOMParser` instead of raw `innerHTML`; plugin HTML wrapped with restrictive CSP meta tag.
- **Asset protocol narrowed** — Reduced from `$HOME/**` to `$DOCUMENT/**`, `$DESKTOP/**`, `$DOWNLOAD/**` to prevent access to sensitive dotfiles (`.ssh`, `.gnupg`, etc.).
- **CI supply chain** — All GitHub Actions pinned to commit SHAs. Added `permissions: contents: read`, `cargo clippy`, and `npm audit` to CI pipeline.
- **Git credential safety** — Generated `.gitignore` now excludes `.env`, `*.key`, `*.pem`, `credentials.json`.

### Performance

- **Cursor-line-only decoration rebuilds** — Image preview and query preview decorations now only rebuild when the cursor moves to a different line, not on every keystroke. Eliminates O(N) work per cursor movement.
- **Global mutable state eliminated** — Indent guides, slash commands, and spellcheck no longer share module-level variables across editor instances, fixing multi-pane interference.
- **Inline styles moved to CSS** — Toast animations and focus-dim styles moved from conditional `<style>` elements to global CSS, reducing DOM churn.

### Bug Fixes

- **CI workflows fixed** — Changed `actions/checkout@v6` and `actions/setup-node@v6` (which don't exist) to `@v4`.
- **Non-ASCII search** — Case-insensitive search now uses Unicode-aware `to_lowercase()` instead of `to_ascii_lowercase()`.
- **Batch export** — No longer includes `.cascade/` internal files in exports.
- **Table editor** — Fixed stale position closure causing content corruption when editing above tables; fixed escaped pipe handling in `parseTableRow`.
- **YAML frontmatter** — Values like `true`, `false`, `null`, and strings with special characters are now properly quoted to prevent type coercion on round-trip.
- **Canvas undo** — Deep-clones node/edge objects to prevent undo snapshot corruption from in-place mutation. Async layout errors are now caught instead of silently failing.
- **Collab stability** — Added try/catch to all collab store operations, validated lifecycle event shapes, added logging to catch blocks, enforced path length limits in sync protocol.
- **MergeConflictDialog** — Reinitializes state when `conflicts` prop changes; added proper ARIA attributes.
- **EditorPane** — Replaced misused `useCallback` IIFE with `useMemo`; switched to cascade-events for consistency.
- **formatAgo** — Now shows "Xd ago" for timestamps older than 24 hours instead of "720 hours ago".
- **Template includes** — `replaceAll` for duplicate `{{include:}}` directives.
- **Settings null guard** — Prevents `typeof null === 'object'` false positive in settings validation.
- **Daily notes** — Properly awaits `openFile` before cursor positioning.
- **Windows path separator** — Removed hardcoded `\\` replacement in PluginsSection that broke macOS/Linux.
- **Collab error types** — All collab commands now use `CascadeError` instead of raw `String` for consistent error handling.
- **Keyboard shortcuts** — Fixed Meta/Ctrl ambiguity so shortcuts can distinguish between the two modifiers when explicitly specified.
- **Wiki-link cache** — Cleared on vault open/close to prevent stale resolution from previous vaults.
- **Theme registry** — Added validation for community theme entries analogous to plugin validation.
- **Confirm dialog** — Added `dismiss` method to prevent hanging callers when dialog is closed without responding.

### Improvements

- **Plugin HTML sandboxing** — Plugin-supplied HTML now includes a restrictive CSP meta tag limiting network access.
- **Settings JSON validation** — `write_vault_settings` validates JSON before writing to prevent corrupt data.
- **Sync log locking** — Added mutex to prevent TOCTOU race condition in log rotation.
- **Dead code cleanup** — Removed unused `is_our_presence` function, deduplicated `sanitize_filename` across importers.
- **Export italic regex** — Word-boundary-aware pattern prevents matching `_underscored_variables_`.
- **Drop handler** — URL encoding now handles `(`, `)`, and spaces for reliable markdown links.
- **Properties styles** — Replaced hardcoded Catppuccin Mocha RGBA values with CSS custom properties for theme compatibility.
- **Inline markdown rendering** — Processes `***bold italic***` before `**bold**` and `*italic*` to prevent incorrect nesting; protects inline code from formatting.
- **Accessibility** — Proper `role="dialog"`, `aria-modal`, `aria-label` on MergeConflictDialog; stable React keys replace array indices.
- **i18n** — CollabUsersPanel strings translated; TabBar "No file open" uses translation; SettingRow uses `useTranslation` hook; SpellcheckOptionsPage uses i18next plural handling.
- **Theme studio** — Added "All" category filter option; heading colors moved to module-level constant.
- **ESLint** — Enabled `@typescript-eslint/no-unused-vars` with underscore exceptions.
- **Color validation** — Theme `applyColors` validates hex format before setting CSS properties.
- **Website** — Updated version badge to v0.3.3; clipboard copy has error handling; screenshot alt text updates on tab switch.

## [0.3.2] — 2026-03-25

### Performance

- **Buttery-smooth scrolling** — Decorations are now built once when opening a file, not on every scroll frame. Previously 11 ViewPlugins all rebuilt decorations on each scroll, causing jank. Now scrolling triggers zero rebuilds for files under 200K characters.
- **GPU-accelerated paint isolation** — Added CSS `contain: strict` on the scroll container and `contain: layout style` on editor content for faster compositing.

### Bug Fixes

- **Source mode shows raw markdown** — Source mode now correctly disables all preview decorations (callouts, images, math, mermaid, tables, wiki-links, tags). Previously 9 standalone preview extensions were active regardless of view mode.
- **New lines below block widgets** — Added 30vh bottom padding and a click handler so you can create new lines below tables, images, and other block widgets at the end of a document.

## [0.3.1] — 2026-03-24

### UI Polish & Component System

- **Button & Input components** — New unified `Button` component with four variants (primary, secondary, ghost, danger), consistent hover/active/disabled states, and press feedback. Reusable `Input` component with animated focus glow. `ToggleSwitch` extracted into a shared component with proper ARIA attributes.
- **Empty states** — Improved empty state screens across Outline, Bookmarks, Tags, and Backlinks panels with contextual icons and helpful hints.
- **Micro-interactions** — Focus ring glow on interactive elements, toast stagger animation when multiple appear, file-saved confirmation pulse in status bar, context menu entrance animation, and drag cursor feedback.
- **Resize dividers** — Sidebar and split pane dividers now highlight with an accent-colored line on hover, show proper grab/grabbing cursors, and have wider hit areas for easy dragging.
- **Keyboard shortcut hints** — New `KbdBadge` component for displaying keyboard shortcuts. Context menus now support a `shortcut` field. Command palette uses styled key badges.
- **Typography system** — Defined a CSS type scale (`--text-2xs` through `--text-lg`). Standardized panel headers, sidebar items, settings rows, and file tree text for consistent information density.

## [0.3.0] — 2026-03-24

### Real-Time Collaboration

Share your vault with others on your local network. Multiple users can edit the same files simultaneously with live cursors, presence indicators, and automatic conflict resolution.

- **Live editing** — See each other's changes in real-time with colored cursors and selections
- **Zero-config discovery** — Automatically detects collaborators via a shared presence file in the vault
- **Password-protected** — Vault password required to join (never saved to disk)
- **Collaborators panel** — New sidebar panel showing connected users and what they're editing
- **File tree presence** — Colored dots in the file tree indicate which files have active collaborators
- **Connection status** — Status bar indicator shows hosting status, connected count, and connection health
- **Auto-promotion** — If the host disconnects, another user automatically takes over
- **Collab-aware saving** — Only the host writes to disk, preventing file conflicts on the shared folder

#### How to Get Started
1. Open a vault from a shared folder location
2. Go to **Settings → Collaboration**
3. Set your display name, pick a cursor color, and enter a vault password
4. Click **Start Hosting**
5. Other users open the same vault, enable collaboration, and they'll connect automatically

### Improvements

- **Table inline markdown** — Bold, italic, links, and other inline formatting now renders inside table cells in live preview
- **Settings profiles** — Create named settings profiles for per-user preferences when sharing a vault
- **Tidemark highlight** — Variable highlights now work in files without frontmatter

### Bug Fixes

- **Fixed click positioning in live preview** — Clicking in the editor now accurately places the cursor where you click. Previously, CSS margins on widget elements caused CodeMirror's height calculations to drift, resulting in clicks landing on the wrong line.
- **Deferred decoration rebuild on click** — Live preview syntax reveal is now deferred by one frame on mouse clicks, preventing the cursor from appearing to jump horizontally.
- **Widget height estimates** — Added `estimatedHeight` to all live preview widgets for more accurate scroll and click positioning before DOM measurement.

## [0.1.0] - 2026-03-09

### Added

#### Core Editor
- CodeMirror 6 editor with Live Preview, Source, and Reading view modes
- Syntax highlighting for markdown, code blocks, and frontmatter
- Wiki-link (`[[note]]`) autocomplete and navigation
- YAML frontmatter properties widget with inline editing
- Inline image preview in live preview mode
- PDF viewer with zoom and fit-to-width controls
- Image viewer with zoom controls
- Find and replace within files (Ctrl+F / Ctrl+H)
- Vault-wide search (Ctrl+Shift+F) with regex, case-sensitive, and whole-word toggles
- Code folding, bracket matching, and active line highlighting
- Spellcheck with custom dictionary and "Add to Dictionary" support
- Vim mode (optional, toggle in settings)
- Auto-save with configurable delay
- Focus mode that dims non-active paragraphs

#### Knowledge Management
- Backlinks panel showing all incoming links to the current note
- Tag index with dedicated tag panel for browsing and filtering
- Graph view with force-directed layout visualizing note connections
- Outline panel for heading-based navigation
- Bookmarks panel for pinning frequently accessed notes
- File properties dialog with word count, character count, line count, backlink count, and tags

#### Organization
- Vault-based file management with collapsible folder tree
- Quick Open (Ctrl+O) with fuzzy file search and recent file tracking
- Command Palette (Ctrl+P) with 40+ commands and keyboard shortcut display
- Tab management with pinning, drag reorder, and overflow menu
- Context menus for files, folders, tabs, and editor
- Drag-and-drop file and folder reorganization
- Move File modal for moving files between folders
- Template system for creating notes from predefined templates
- Welcome view with vault stats, recent files, and tag cloud

#### Import & Export
- Import wizard supporting Obsidian, Notion (ZIP), Logseq, Roam Research (JSON), and plain markdown folders
- Export to Markdown, HTML, and PDF formats
- Batch export with scope selection (current file, folder, or entire vault)
- Configurable export options (frontmatter inclusion, image embedding)

#### Plugin System
- Sandboxed plugin execution in iframes with postMessage RPC bridge
- Plugin API for registering commands, settings, sidebar panels, and status bar items
- Plugin marketplace UI with search and install/uninstall
- Permission-based API access control
- Event system for file changes, editor events, and custom plugin events

#### Settings & Customization
- 20+ settings categories: Editor, Appearance, Files, General, Features, Plugins, Keyboard Shortcuts, Auto-Save, Backlinks, Bookmarks, Image Preview, Live Preview, Properties, Search, Spellcheck, Status Bar, Tags, Wiki Links
- Four Catppuccin color themes: Mocha (dark), Macchiato (dark), Frappe (dark), Latte (light)
- Configurable UI font, editor font, font size, and line height
- Custom CSS variable theming (`--ctp-*` tokens)
- Settings persisted per-vault

#### Internationalization
- i18next integration with react-i18next
- 13 feature-based translation namespaces (common, settings, editor, search, sidebar, export, import, commands, graph, plugins, dialogs, errors, statusbar)
- English locale with ~2,200+ translation keys
- Language preference stored in vault settings
- Dynamic `html[lang]` attribute updates

#### Desktop Integration
- Custom frameless title bar with window controls
- Native file system access via Tauri v2 IPC
- File watching with Rust `notify` crate for external change detection
- Path security with directory traversal prevention
- About dialog with version and build information

#### UI & Accessibility
- Keyboard-navigable command palette and quick open
- Focus trap in modal dialogs
- Close animations on modals and dialogs
- Responsive sidebar with resizable width (persisted)
- Status bar with word count, line count, cursor position, and view mode

#### Testing
- 71 Playwright E2E tests across 3 test suites
  - Sidebar interactions (21 tests): file tree, context menus, tabs, command palette, quick open, file CRUD
  - Editor (29 tests): core editing, view modes, markdown rendering, search/replace, keyboard shortcuts
  - Plugin system (21 tests): settings UI, store state, sandbox security, UI integration, registry, error handling
