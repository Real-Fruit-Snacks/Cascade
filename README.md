<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Real-Fruit-Snacks/Cascade/main/docs/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Real-Fruit-Snacks/Cascade/main/docs/assets/logo-light.svg">
  <img alt="Cascade" src="https://raw.githubusercontent.com/Real-Fruit-Snacks/Cascade/main/docs/assets/logo-dark.svg" width="520">
</picture>

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-orange?style=flat&logo=rust&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**Modern native markdown editor with real-time collaboration, canvas whiteboard, and 21+ themes**

Vault-based knowledge management built with Tauri and Rust. Live preview, wiki-links with backlinks,
graph view, infinite canvas, slash commands, focus mode, split panes, plugin system, and full offline
operation. Your files stay on your disk.

</div>

---

## Quick Start

### Pre-built Binaries

Download the latest release from the [Releases](https://github.com/Real-Fruit-Snacks/Cascade/releases) page:

| Platform | Format |
|----------|--------|
| Windows  | `.msi` installer |
| macOS    | `.dmg` disk image |
| Linux    | `.AppImage` / `.deb` |

### Build from Source

Prerequisites: Node.js 18+, Rust 1.70+, Tauri CLI 2.x.

```bash
git clone https://github.com/Real-Fruit-Snacks/Cascade.git
cd Cascade

npm install
npm run tauri dev       # development mode
npm run tauri build     # production build
```

### Verify

```bash
npm test                # unit tests (Vitest)
npx playwright test     # E2E tests
npm run lint            # ESLint
```

---

## Features

### Live Preview Editor

CodeMirror 6 with three view modes -- Live Preview, Source, and Reading. Syntax highlighting, code folding, bracket matching, line numbers, and optional Vim mode with seamless switching between modes.

```
/heading    → insert heading
/code       → insert code block
/callout    → insert callout
/table      → insert table
```

Inline image preview with resize controls, LaTeX math rendering, and Mermaid diagram support. Table editor with column and row manipulation. Find and replace across notes with `Ctrl+Shift+F`.

### Wiki-Links and Knowledge Graph

`[[note]]` links with autocomplete, backlink tracking, and heading links. Graph view visualizing connections between notes with a backlinks panel, tag index, and outline navigation.

```markdown
[[my-note]]           # link to note
[[my-note#heading]]   # link to heading
![[my-note]]          # embed / transclusion
#tag                  # tag with autocomplete
> [!NOTE]             # callout block
$$E = mc^2$$          # LaTeX math
```

Backlinks panel shows all notes linking to the current note. Tag index with browsing and renaming. Table of contents generation and bookmarks for quick access.

### Real-Time Collaboration

Live collaborative editing via Yjs CRDT sync. Multiple users edit simultaneously with live cursors and per-user colors. Auto host election with zero-config discovery and password-protected sessions using Argon2 hashing.

```
Collab features:
  - Live cursors and selections
  - Collaborator presence sidebar
  - Auto host promotion on disconnect
  - Collab-aware file operations (rename/delete sync)
  - Per-user settings profiles
```

### Canvas Whiteboard

Infinite canvas for visual thinking with pan, zoom, and snap-to-grid. Text, file, and link cards with markdown rendering. Connect cards with edges and auto-layout algorithms. `.canvas` format compatible with Obsidian.

```
Card types:  text, file, link
Layout:      grid, tree, force-directed
Export:      PNG, SVG
Groups:      collapsible card grouping
Operations:  undo/redo, copy/paste, lock/unlock
```

### 21+ Built-in Themes

Catppuccin (Mocha, Macchiato, Frappe, Latte), Nord, Dracula, Gruvbox, Tokyo Night, One Dark, Solarized, Rose Pine, GitHub, Monokai, Material, Night Owl, Ayu, Kanagawa, Everforest. Custom theme support via JSON with a visual card picker.

```json
{
  "name": "my-theme",
  "colors": {
    "background": "#1e1e2e",
    "foreground": "#cdd6f4",
    "accent": "#cba6f7"
  }
}
```

### Import and Export

Import from Obsidian, Notion, Bear, and Roam Research. Export to Markdown, HTML, or PDF with batch export. Deep link support via `cascade://open/vault/note`. GitHub sync for vault backup.

```bash
# Supported import sources
Obsidian    →  vault migration with wiki-link conversion
Notion      →  database and page import
Bear/Roam   →  note conversion with tag preservation

# Export formats
Markdown    →  plain .md files
HTML        →  styled single-page output
PDF         →  print-ready documents (batch supported)
```

### Plugin System

Sandboxed iframe plugin execution with a built-in marketplace. 30+ configurable feature toggles with per-feature option pages. Customizable keyboard shortcuts and internationalization support (i18next, 2200+ translation keys).

```
Plugin lifecycle:
  1. Install from marketplace or local directory
  2. Sandboxed iframe execution with restrictive CSP
  3. Access vault API through message passing
  4. Per-plugin settings in the options panel
```

### Focus and Writing Tools

Focus mode with paragraph dimming and typewriter mode keeping the current line centered. Word count goals with progress tracking, auto-save with timer and focus-change triggers, and split panes for side-by-side editing.

```
Focus mode     →  paragraph dimming, distraction-free
Typewriter     →  current line stays centered
Word goals     →  progress bar with target tracking
Split panes    →  side-by-side note editing
Quick Open     →  Ctrl+O for fast file switching
Command Palette →  Ctrl+P with 40+ commands
```

---

## Architecture

```
Cascade/
├── src/                    # React frontend
│   ├── components/         # 40+ UI components
│   ├── editor/             # CodeMirror 6 extensions
│   │   ├── wiki-links.ts
│   │   ├── collab-extension.ts
│   │   ├── slash-commands/
│   │   └── live-preview/
│   ├── stores/             # Zustand state management
│   ├── hooks/              # Custom React hooks
│   └── i18n/               # Internationalization
├── src-tauri/src/          # Rust backend (Tauri v2)
│   ├── collab/             # WebSocket collaboration server
│   ├── vault/              # File I/O, themes, plugins, export
│   ├── search.rs           # Full-text search
│   └── watcher.rs          # File system watcher
├── tests/e2e/              # Playwright E2E tests
└── docs/                   # GitHub Pages site
```

Tauri v2 provides the native runtime with a Rust backend handling file operations, collaboration, and search. The React frontend uses CodeMirror 6 for editing, Zustand for state management, and Yjs for CRDT-based real-time collaboration sync.

---

## Platform Support

| Capability | Linux | macOS | Windows |
|------------|-------|-------|---------|
| Editor (all modes) | Full | Full | Full |
| Canvas Whiteboard | Full | Full | Full |
| Real-Time Collaboration | Full | Full | Full |
| Import / Export | Full | Full | Full |
| Plugin System | Full | Full | Full |
| 21+ Themes | Full | Full | Full |
| GitHub Sync | Full | Full | Full |
| Deep Links | `cascade://` | `cascade://` | `cascade://` |
| Installer | `.AppImage` / `.deb` | `.dmg` | `.msi` |

---

## License

[MIT](LICENSE) — Copyright 2026 Real-Fruit-Snacks
