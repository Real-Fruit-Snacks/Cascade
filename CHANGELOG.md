# Changelog

All notable changes to Cascade will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
