# Changelog

All notable changes to Cascade will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
