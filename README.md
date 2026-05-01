<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Real-Fruit-Snacks/Cascade/main/docs/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Real-Fruit-Snacks/Cascade/main/docs/assets/logo-light.svg">
  <img alt="Cascade" src="https://raw.githubusercontent.com/Real-Fruit-Snacks/Cascade/main/docs/assets/logo-dark.svg" width="100%">
</picture>

> [!IMPORTANT]
> **Modern native markdown editor with real-time collaboration, canvas whiteboard, and 21+ themes.** Vault-based knowledge management built with Tauri and Rust. Live preview, wiki-links with backlinks, graph view, infinite canvas, slash commands, focus mode, split panes, plugin system, and full offline operation. Your files stay on your disk.

> *A cascade chains one drop into the next — a vault chains one note into the next. Felt fitting for an editor that ties wiki-links, backlinks, and a graph view together over plain markdown on your disk.*

---

## §1 / Premise

Cascade is a **vault-based markdown editor** built on Tauri v2 with a Rust backend and a React + CodeMirror 6 frontend. Three view modes (Live Preview, Source, Reading), wiki-links with autocomplete and backlinks, an infinite canvas whiteboard (Obsidian-compatible `.canvas` format), and real-time collaboration via Yjs CRDT sync with auto-elected hosts.

Files live as plain markdown on your disk. Tauri provides the native shell with deep links (`cascade://open/vault/note`) and platform-native installers. Plugins run in sandboxed iframes with a restrictive CSP and access the vault through message passing.

---

## §2 / Specs

| KEY        | VALUE                                                                       |
|------------|-----------------------------------------------------------------------------|
| EDITOR     | **CodeMirror 6** · Live Preview · Source · Reading · optional Vim mode      |
| LINKS      | `[[note]]` · `[[note#heading]]` · `![[embed]]` · `#tag` · backlinks panel   |
| GRAPH      | Knowledge graph view · backlinks · tag index · TOC · bookmarks              |
| CANVAS     | Infinite · pan · zoom · snap · text/file/link cards · `.canvas` (Obsidian)  |
| COLLAB     | **Yjs CRDT** · live cursors · auto host election · Argon2 password sessions |
| THEMES     | **21+ built-in** · Catppuccin · Nord · Dracula · Gruvbox · Tokyo Night · Rose Pine · custom JSON |
| IMPORT     | Obsidian · Notion · Bear · Roam Research                                    |
| EXPORT     | Markdown · HTML · PDF · batch export                                        |
| PLUGINS    | Sandboxed iframes · marketplace · per-plugin settings · message-passing API |
| I18N       | i18next · 2200+ translation keys                                            |
| STACK      | **Tauri v2** · Rust · React · TypeScript · CodeMirror 6 · Zustand · Yjs · MIT |

Architecture in §5 below.

---

## §3 / Quickstart

### Pre-built binaries

Download the latest release from the [Releases](https://github.com/Real-Fruit-Snacks/Cascade/releases) page:

| Platform | Format |
|----------|--------|
| Windows  | `.msi` installer |
| macOS    | `.dmg` disk image |
| Linux    | `.AppImage` / `.deb` |

### Build from source

Prerequisites: **Node.js 18+**, **Rust 1.70+**, **Tauri CLI 2.x**.

```bash
git clone https://github.com/Real-Fruit-Snacks/Cascade.git
cd Cascade
npm install
npm run tauri dev       # development
npm run tauri build     # production
```

```bash
npm test                # unit tests (Vitest)
npx playwright test     # E2E tests
npm run lint            # ESLint
```

---

## §4 / Reference

```
SLASH COMMANDS

  /heading             Insert heading
  /code                Insert code block
  /callout             Insert callout
  /table               Insert table

MARKDOWN EXTENSIONS

  [[my-note]]          Wiki-link to note
  [[my-note#heading]]  Wiki-link to heading
  ![[my-note]]         Embed / transclusion
  #tag                 Tag with autocomplete
  > [!NOTE]            Callout block
  $$E = mc^2$$         LaTeX math (KaTeX)

CANVAS

  Card types           text · file · link
  Layouts              grid · tree · force-directed
  Export               PNG · SVG
  Groups               collapsible card grouping
  Operations           undo/redo · copy/paste · lock/unlock

COLLABORATION

  Live cursors and selections per user
  Collaborator presence sidebar
  Auto host promotion on disconnect
  Collab-aware file ops (rename / delete sync)
  Per-user settings profiles

WRITING TOOLS

  Focus mode           Paragraph dimming · distraction-free
  Typewriter           Current line stays centered
  Word goals           Progress bar with target tracking
  Split panes          Side-by-side note editing
  Quick Open           Ctrl+O for fast file switching
  Command Palette      Ctrl+P · 40+ commands

CUSTOM THEME

  {
    "name": "my-theme",
    "colors": {
      "background": "#1e1e2e",
      "foreground": "#cdd6f4",
      "accent": "#cba6f7"
    }
  }
```

---

## §5 / Architecture

```
src/                   React frontend
  components/          40+ UI components
  editor/              CodeMirror 6 extensions
    wiki-links.ts
    collab-extension.ts
    slash-commands/
    live-preview/
  stores/              Zustand state management
  hooks/               Custom React hooks
  i18n/                Internationalization (2200+ keys)

src-tauri/src/         Rust backend (Tauri v2)
  collab/              WebSocket collaboration server
  vault/               File I/O · themes · plugins · export
  search.rs            Full-text search
  watcher.rs           File system watcher

tests/e2e/             Playwright E2E tests
```

| Layer        | Implementation                                                  |
|--------------|-----------------------------------------------------------------|
| **Shell**    | Tauri v2 · platform-native installers · deep-link `cascade://`  |
| **Editor**   | CodeMirror 6 · slash commands · live preview · vim mode         |
| **Backend**  | Rust · file I/O · search · watcher · plugin sandbox             |
| **Collab**   | Yjs CRDT · WebSocket server · auto host election · Argon2 password sessions |
| **State**    | Zustand                                                         |
| **Plugins**  | Sandboxed iframes · restrictive CSP · message-passing API       |

**Key patterns:** Files stay on your disk as plain markdown — no proprietary database, no lock-in. Vault operations go through the Rust backend; the React frontend only sees what's needed. Collab is opt-in per session and ends with the connection.

---

## §6 / Platform support

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

[License: MIT](LICENSE) · Part of [Real-Fruit-Snacks](https://github.com/Real-Fruit-Snacks) — building offensive security tools, one wave at a time.
