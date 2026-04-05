<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Real-Fruit-Snacks/Cascade/main/docs/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Real-Fruit-Snacks/Cascade/main/docs/assets/logo-light.svg">
  <img alt="Cascade" src="https://raw.githubusercontent.com/Real-Fruit-Snacks/Cascade/main/docs/assets/logo-dark.svg" width="520">
</picture>

![TypeScript](https://img.shields.io/badge/language-TypeScript%20%2B%20Rust-blue.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**Modern native markdown editor with real-time collaboration, canvas whiteboard, and 21+ themes**

Vault-based knowledge management built with Tauri and Rust. Live preview, wiki-links with backlinks, graph view, infinite canvas, slash commands, focus mode, split panes, plugin system, and full offline operation. Your files stay on your disk.

[Quick Start](#quick-start) • [Editor](#editor) • [Collaboration](#real-time-collaboration) • [Canvas](#canvas-whiteboard) • [Architecture](#architecture) • [Platform Support](#platform-support) • [Security](#security)

</div>

---

## Highlights

<table>
<tr>
<td width="50%">

**Live Preview Editor**
CodeMirror 6 with syntax highlighting, code folding, bracket matching, and line numbers. Three view modes — live preview, source, and reading — with seamless switching. Inline image preview, LaTeX math rendering, and Mermaid diagram support.

**Wiki-Links & Knowledge Graph**
`[[note]]` links with autocomplete, backlink tracking, and heading links. Graph view visualizing connections between notes. Backlinks panel, tag index, outline navigation, and table of contents generation. Embed preview for transclusion (`![[note]]`).

**Real-Time Collaboration**
Live collaborative editing via Yjs CRDT sync. Multiple users edit simultaneously with live cursors and selections. Auto host election with zero-config discovery. Password-protected sessions with Argon2 hashing.

**21+ Built-in Themes**
Catppuccin (Mocha, Macchiato, Frappe, Latte), Nord, Dracula, Gruvbox, Tokyo Night, One Dark, Solarized, Rose Pine, GitHub, Monokai, Material, Night Owl, Ayu, Kanagawa, Everforest. Custom theme support via JSON with visual card picker.

</td>
<td width="50%">

**Canvas Whiteboard**
Infinite canvas for visual thinking with pan, zoom, and snap-to-grid. Text, file, and link cards with markdown rendering. Connect cards with edges. Auto-layout (grid, tree, force-directed). Export to PNG or SVG. `.canvas` format compatible with Obsidian.

**Focus & Writing Tools**
Focus mode with paragraph dimming. Typewriter mode keeping the current line centered. Word count goals with progress tracking. Auto-save with timer and focus-change modes. Split panes for side-by-side editing.

**Import & Export**
Import from Obsidian, Notion, Bear, and Roam Research. Export to Markdown, HTML, or PDF with batch export support. Deep link support (`cascade://open/vault/note`). GitHub sync for vault backup.

**Plugin System & Extensibility**
Sandboxed iframe plugin execution with marketplace. 30+ configurable feature toggles with per-feature option pages. Customizable keyboard shortcuts. Slash commands for inserting headings, code blocks, callouts, tables, and more. Internationalization ready (i18next, 2200+ keys).

</td>
</tr>
</table>

---

## Quick Start

### Prerequisites

<table>
<tr>
<th>Requirement</th>
<th>Version</th>
<th>Purpose</th>
</tr>
<tr>
<td>Node.js</td>
<td>18+</td>
<td>Frontend build toolchain</td>
</tr>
<tr>
<td>Rust</td>
<td>1.70+</td>
<td>Tauri backend compiler</td>
</tr>
<tr>
<td>Tauri CLI</td>
<td>2.x</td>
<td>Desktop app bundler</td>
</tr>
</table>

### Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/Real-Fruit-Snacks/Cascade/releases) page.

<table>
<tr>
<th>Platform</th>
<th>Format</th>
</tr>
<tr>
<td>Windows</td>
<td><code>.msi</code> installer</td>
</tr>
<tr>
<td>macOS</td>
<td><code>.dmg</code> disk image</td>
</tr>
<tr>
<td>Linux</td>
<td><code>.AppImage</code> / <code>.deb</code></td>
</tr>
</table>

### Build from Source

```bash
# Clone repository
git clone https://github.com/Real-Fruit-Snacks/Cascade.git
cd Cascade

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Verification

```bash
# Start development server
npm run dev

# Run unit tests
npm test

# Run E2E tests (requires app running)
npx playwright test

# Lint
npm run lint
```

---

## Editor

### View Modes

Three modes with seamless switching — **Live Preview**, **Source**, and **Reading**. CodeMirror 6 powers the editor with syntax highlighting, code folding, bracket matching, line numbers, and optional Vim mode.

### Slash Commands

Type `/` to insert headings, code blocks, callouts, tables, and more. Context-aware completions with keyboard navigation.

### Markdown Features

<table>
<tr>
<th>Feature</th>
<th>Syntax</th>
<th>Description</th>
</tr>
<tr>
<td>Wiki-links</td>
<td><code>[[note]]</code></td>
<td>Autocomplete, backlink tracking, heading links</td>
</tr>
<tr>
<td>Embeds</td>
<td><code>![[note]]</code></td>
<td>Transclusion with inline preview</td>
</tr>
<tr>
<td>Highlights</td>
<td><code>==text==</code></td>
<td>Highlighted text syntax</td>
</tr>
<tr>
<td>Callouts</td>
<td><code>> [!NOTE]</code></td>
<td>NOTE, WARNING, TIP, and custom types</td>
</tr>
<tr>
<td>Math</td>
<td><code>$$...$$</code></td>
<td>LaTeX block preview</td>
</tr>
<tr>
<td>Diagrams</td>
<td><code>```mermaid</code></td>
<td>Mermaid diagram rendering</td>
</tr>
<tr>
<td>Frontmatter</td>
<td><code>---</code></td>
<td>YAML properties editor with type indicators</td>
</tr>
<tr>
<td>Tags</td>
<td><code>#tag</code></td>
<td>Autocomplete, nested support, tag panel</td>
</tr>
</table>

### Editor Tools

- Inline image preview with resize and alignment controls
- Table editor with column/row manipulation
- Find and replace across notes (`Ctrl+Shift+F`)
- Spellcheck with custom dictionary support
- Smart lists (auto-continue bullets, tasks, numbered lists)
- Indent guides with customizable style and color
- Query/Dataview-like preview blocks

---

## Real-Time Collaboration

Live collaborative editing for shared folder vaults — multiple users edit the same note simultaneously.

<table>
<tr>
<th>Feature</th>
<th>Description</th>
</tr>
<tr>
<td>Live cursors</td>
<td>Real-time cursor positions and selections with per-user colors</td>
</tr>
<tr>
<td>Presence</td>
<td>Collaborators sidebar and file tree presence dots</td>
</tr>
<tr>
<td>Discovery</td>
<td>Auto host election with presence file — zero config</td>
</tr>
<tr>
<td>Security</td>
<td>Password-protected sessions, Argon2 hashed, never saved to disk</td>
</tr>
<tr>
<td>Resilience</td>
<td>Automatic host promotion on disconnect</td>
</tr>
<tr>
<td>Sync</td>
<td>Collab-aware file operations — rename/delete events sync across users</td>
</tr>
<tr>
<td>Profiles</td>
<td>Per-user settings profiles when sharing a vault</td>
</tr>
</table>

**Powered by Yjs CRDT** — conflict-free replicated data types ensure edits merge correctly regardless of network conditions.

---

## Canvas Whiteboard

Infinite canvas for visual thinking — pan, zoom, and snap-to-grid with `.canvas` file format compatible with Obsidian.

- **Cards** — Text, file, and link cards with markdown rendering
- **Edges** — Connect cards with arrows, labels, colors, and line styles
- **Groups** — Organize related cards into collapsible groups
- **Auto-layout** — Grid, tree, and force-directed layout algorithms
- **Tools** — Alignment, distribution, minimap, canvas search
- **Export** — PNG or SVG output
- **Operations** — Undo/redo, copy/paste, duplicate, lock/unlock nodes

---

## Knowledge Management

### Navigation

- **Backlinks panel** showing all notes linking to the current note
- **Graph view** visualizing connections between notes
- **Tag index** with tag panel for browsing and renaming
- **Bookmarks** for quick access to frequently used notes
- **Outline panel** for heading navigation
- **Table of contents** generation

### Periodic Notes

Daily, weekly, monthly, quarterly, and yearly notes with templates.

### Organization

- Vault-based file management with folder tree
- Quick Open (`Ctrl+O`) for fast file switching
- Command Palette (`Ctrl+P`) with 40+ commands
- Drag-and-drop file reorganization
- File properties dialog (word count, backlinks, tags)
- Template system with variable replacement and custom delimiters
- Folder colors with multiple display styles
- GitHub sync for vault backup and collaboration

---

## Import & Export

<table>
<tr>
<th>Direction</th>
<th>Formats</th>
</tr>
<tr>
<td>Import</td>
<td>Obsidian, Notion, Bear, Roam Research, plain Markdown</td>
</tr>
<tr>
<td>Export</td>
<td>Markdown, HTML, PDF (with batch export)</td>
</tr>
</table>

---

## Customization

### Themes

21+ built-in themes with custom theme support via JSON:

Catppuccin (Mocha, Macchiato, Frappe, Latte) · Nord · Dracula · Gruvbox · Tokyo Night · One Dark · Solarized · Rose Pine · GitHub · Monokai · Material · Night Owl · Ayu · Kanagawa · Everforest

### Configuration

- Configurable fonts (UI and editor), font sizes, and line height
- 30+ configurable feature toggles with per-feature option pages
- Customizable keyboard shortcuts
- Internationalization ready (i18next, 2200+ keys)
- Plugin system with sandboxed iframe execution and marketplace

---

## Architecture

```
Cascade/
├── package.json                      # Dependencies, scripts, Vite + Tauri config
├── vite.config.ts                    # Vite build configuration
├── tailwind.config.js                # Tailwind CSS theme tokens
├── tsconfig.json                     # TypeScript compiler options
│
├── src/                              # ── React Frontend ──
│   ├── main.tsx                      # Entry point, React root mount
│   ├── App.tsx                       # Root component, routing, theme provider
│   ├── components/                   # UI components (40+)
│   │   ├── AppShell.tsx              # Main layout — sidebar, tabs, editor
│   │   ├── EditorPane.tsx            # CodeMirror wrapper with mode switching
│   │   ├── CommandPalette.tsx        # Ctrl+P command launcher
│   │   ├── SettingsModal.tsx         # Settings UI with feature toggles
│   │   ├── ImportWizard.tsx          # Multi-source import flow
│   │   ├── ExportModal.tsx           # Markdown, HTML, PDF export
│   │   └── ...                       # 35+ more components
│   │
│   ├── editor/                       # ── CodeMirror 6 Extensions ──
│   │   ├── build-extensions.ts       # Extension assembly and configuration
│   │   ├── wiki-links.ts            # [[link]] syntax and navigation
│   │   ├── wiki-link-completion.ts   # Autocomplete for wiki-links
│   │   ├── collab-extension.ts       # Yjs CRDT binding for live editing
│   │   ├── image-preview.ts          # Inline image rendering
│   │   ├── math-preview.ts           # LaTeX math block rendering
│   │   ├── mermaid-preview.ts        # Mermaid diagram rendering
│   │   ├── table-editor.ts           # Table column/row manipulation
│   │   ├── slash-commands/           # Slash command menu and handlers
│   │   └── live-preview/             # Live preview rendering engine
│   │
│   ├── stores/                       # ── Zustand State ──
│   │   ├── vault-store.ts            # Vault file tree and operations
│   │   ├── editor-store.ts           # Editor state, tabs, sessions
│   │   ├── canvas-store.ts           # Canvas nodes, edges, layout
│   │   ├── collab-store.ts           # Collaboration presence and sync
│   │   ├── settings-store.ts         # User preferences and feature flags
│   │   ├── plugin-store.ts           # Plugin registry and lifecycle
│   │   └── theme-studio-store.ts     # Custom theme editor state
│   │
│   ├── hooks/                        # ── Custom React Hooks ──
│   │   ├── use-keyboard-shortcuts.ts # Global keybinding manager
│   │   ├── use-commands.ts           # Command palette registration
│   │   ├── use-fs-watcher.ts         # File system change monitoring
│   │   └── use-theme-setup.ts        # Theme loading and application
│   │
│   ├── i18n/                         # Internationalization config
│   ├── locales/en/                   # English translation files (2200+ keys)
│   ├── plugin-api/                   # Plugin sandbox system
│   ├── lib/                          # Utility functions
│   └── styles/                       # Global CSS and theme variables
│
├── src-tauri/                        # ── Rust Backend (Tauri v2) ──
│   └── src/
│       ├── main.rs                   # Tauri entry point and plugin registration
│       ├── lib.rs                    # Library root with command exports
│       ├── error.rs                  # Custom error types
│       ├── collab/                   # ── Collaboration Server ──
│       │   ├── server.rs             # WebSocket server (localhost-bound)
│       │   ├── presence.rs           # User presence and host election
│       │   └── commands.rs           # Collab IPC command handlers
│       ├── vault/                    # ── Vault Operations ──
│       │   ├── file_io.rs            # File read/write with path validation
│       │   ├── file_ops.rs           # Create, rename, delete, move
│       │   ├── themes.rs             # Theme loading and management
│       │   ├── plugins.rs            # Plugin discovery and loading
│       │   ├── settings.rs           # Settings persistence
│       │   ├── export.rs             # PDF/HTML export engine
│       │   └── trash.rs              # Safe file deletion
│       ├── search.rs                 # Full-text search engine
│       ├── indexer.rs                # File content indexer
│       ├── git.rs                    # Git sync operations
│       ├── watcher.rs                # File system watcher
│       └── importer.rs               # Obsidian/Notion/Bear/Roam importers
│
├── tests/                            # ── Tests ──
│   └── e2e/                          # Playwright E2E tests
│
├── docs/                             # ── GitHub Pages ──
│   ├── index.html                    # Project website
│   └── assets/
│       ├── logo-dark.svg             # Logo for dark theme
│       └── logo-light.svg            # Logo for light theme
│
└── .github/
    ├── workflows/
    │   ├── ci.yml                    # CI pipeline (lint, test, clippy, audit)
    │   └── release.yml               # Automated release builds
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.yml            # Bug report form
    │   └── feature_request.yml       # Feature request form
    └── PULL_REQUEST_TEMPLATE.md      # PR checklist
```

### Tech Stack

<table>
<tr>
<th>Layer</th>
<th>Technology</th>
<th>Purpose</th>
</tr>
<tr>
<td>Runtime</td>
<td>Tauri v2</td>
<td>Rust backend + native WebView (no Electron)</td>
</tr>
<tr>
<td>Frontend</td>
<td>React 19 + TypeScript</td>
<td>Component UI with type safety</td>
</tr>
<tr>
<td>Editor</td>
<td>CodeMirror 6</td>
<td>Extensible text editor with custom extensions</td>
</tr>
<tr>
<td>Styling</td>
<td>Tailwind CSS</td>
<td>Utility-first CSS framework</td>
</tr>
<tr>
<td>State</td>
<td>Zustand 5</td>
<td>Lightweight reactive state management</td>
</tr>
<tr>
<td>Collaboration</td>
<td>Yjs</td>
<td>CRDT real-time sync</td>
</tr>
<tr>
<td>i18n</td>
<td>react-i18next</td>
<td>Internationalization (2200+ keys)</td>
</tr>
<tr>
<td>Testing</td>
<td>Vitest + Playwright</td>
<td>Unit and E2E test suites</td>
</tr>
</table>

---

## Platform Support

<table>
<tr>
<th>Capability</th>
<th>Linux</th>
<th>macOS</th>
<th>Windows</th>
</tr>
<tr>
<td>Editor (all view modes)</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>Live Preview</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>Wiki-links & Backlinks</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>Canvas Whiteboard</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>Real-Time Collaboration</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>Graph View</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>Import (Obsidian/Notion/Bear/Roam)</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>Export (Markdown/HTML/PDF)</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>Plugin System</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>21+ Themes</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>GitHub Sync</td>
<td>Full</td>
<td>Full</td>
<td>Full</td>
</tr>
<tr>
<td>Deep Links</td>
<td><code>cascade://</code></td>
<td><code>cascade://</code></td>
<td><code>cascade://</code></td>
</tr>
<tr>
<td>File System Watcher</td>
<td>inotify</td>
<td>FSEvents</td>
<td>ReadDirectoryChanges</td>
</tr>
<tr>
<td>Installer Format</td>
<td><code>.AppImage</code> / <code>.deb</code></td>
<td><code>.dmg</code></td>
<td><code>.msi</code></td>
</tr>
</table>

---

## Security

### Vulnerability Reporting

**Report security issues via:**
- GitHub Security Advisories (preferred)
- Private disclosure to maintainers
- Responsible disclosure timeline (90 days)

**Do NOT:**
- Open public GitHub issues for vulnerabilities
- Disclose before coordination with maintainers

### Threat Model

**In scope:**
- Local vault file integrity and path traversal protection
- Collaboration session authentication and localhost binding
- Plugin sandboxing via restrictive CSP and iframe isolation
- CI pipeline hardening with SHA-pinned actions and dependency auditing

**Out of scope:**
- Cloud-based vault hosting or server-side storage
- End-to-end encryption for collaboration over the internet
- DRM or copy protection of exported content

### What Cascade Does NOT Do

Cascade is a **local-first markdown editor**, not a cloud platform:

- **Not a cloud service** — Files stay on your disk, no account required
- **Not a database** — Plain markdown files, no proprietary format lock-in
- **Not a web app** — Native desktop application via Tauri, no browser required
- **Not a CMS** — Personal knowledge management, not content publishing

---

## License

MIT License

Copyright &copy; 2026 Real-Fruit-Snacks

```
THIS SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.
THE AUTHORS ARE NOT LIABLE FOR ANY DAMAGES ARISING FROM USE.
USE AT YOUR OWN RISK.
```

---

## Resources

- **GitHub**: [github.com/Real-Fruit-Snacks/Cascade](https://github.com/Real-Fruit-Snacks/Cascade)
- **Releases**: [Latest Release](https://github.com/Real-Fruit-Snacks/Cascade/releases/latest)
- **Issues**: [Report a Bug](https://github.com/Real-Fruit-Snacks/Cascade/issues)
- **Security**: [SECURITY.md](SECURITY.md)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

---

<div align="center">

**Part of the Real-Fruit-Snacks water-themed security toolkit**

[Aquifer](https://github.com/Real-Fruit-Snacks/Aquifer) • [armsforge](https://github.com/Real-Fruit-Snacks/armsforge) • **Cascade** • [Conduit](https://github.com/Real-Fruit-Snacks/Conduit) • [Deadwater](https://github.com/Real-Fruit-Snacks/Deadwater) • [Deluge](https://github.com/Real-Fruit-Snacks/Deluge) • [Depth](https://github.com/Real-Fruit-Snacks/Depth) • [Dew](https://github.com/Real-Fruit-Snacks/Dew) • [Droplet](https://github.com/Real-Fruit-Snacks/Droplet) • [Fathom](https://github.com/Real-Fruit-Snacks/Fathom) • [Flux](https://github.com/Real-Fruit-Snacks/Flux) • [Grotto](https://github.com/Real-Fruit-Snacks/Grotto) • [HydroShot](https://github.com/Real-Fruit-Snacks/HydroShot) • [LigoloSupport](https://github.com/Real-Fruit-Snacks/LigoloSupport) • [Maelstrom](https://github.com/Real-Fruit-Snacks/Maelstrom) • [Rapids](https://github.com/Real-Fruit-Snacks/Rapids) • [Ripple](https://github.com/Real-Fruit-Snacks/Ripple) • [Riptide](https://github.com/Real-Fruit-Snacks/Riptide) • [Runoff](https://github.com/Real-Fruit-Snacks/Runoff) • [Seep](https://github.com/Real-Fruit-Snacks/Seep) • [Shallows](https://github.com/Real-Fruit-Snacks/Shallows) • [Siphon](https://github.com/Real-Fruit-Snacks/Siphon) • [Slipstream](https://github.com/Real-Fruit-Snacks/Slipstream) • [Spillway](https://github.com/Real-Fruit-Snacks/Spillway) • [Sunken-Archive](https://github.com/Real-Fruit-Snacks/Sunken-Archive) • [Surge](https://github.com/Real-Fruit-Snacks/Surge) • [Tidemark](https://github.com/Real-Fruit-Snacks/Tidemark) • [Tidepool](https://github.com/Real-Fruit-Snacks/Tidepool) • [Undercurrent](https://github.com/Real-Fruit-Snacks/Undercurrent) • [Undertow](https://github.com/Real-Fruit-Snacks/Undertow) • [Vapor](https://github.com/Real-Fruit-Snacks/Vapor) • [Wellspring](https://github.com/Real-Fruit-Snacks/Wellspring) • [Whirlpool](https://github.com/Real-Fruit-Snacks/Whirlpool)

*Remember: With great power comes great responsibility.*

</div>
