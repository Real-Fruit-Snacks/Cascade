# Area 8: Plugin System Review

## Files Reviewed
- `src/plugin-api/index.ts` — plugin API entry
- `src/plugin-api/sandbox.ts` — iframe sandbox execution
- `src/plugin-api/types.ts` — plugin API types
- `src/stores/plugin-store.ts` — plugin state
- `src/lib/plugin-registry.ts` — plugin registration

## Findings

### Fixed Issues

- [x] Fixed: `SettingsAPI` type missing from `index.ts` re-exports — consumers importing from `plugin-api` could not access the `SettingsAPI` interface
- [x] Fixed: `ui.removeCommand` RPC handler returned `{ error: '...' }` object instead of throwing — sandbox treated this as a successful result, silently swallowing the "not implemented" error
- [x] Fixed: Duplicate cleanup registration in `vault.onFileChange` — the unsub function was added to both `eventCallbacks` map and `cleanups` array, causing `destroy()` to invoke it twice
- [x] Fixed: Duplicate cleanup registration in `events.on` — same double-registration issue as `vault.onFileChange`
- [x] Fixed: `events.emit` dispatched on `cascade:plugin:${pluginId}:${event}` but `events.on` listened on `cascade:plugin:${event}` — cross-plugin event communication was broken; now emits on both namespaced and generic channels
- [x] Fixed: No path traversal validation on `vault.readFile`/`vault.writeFile` RPC args — a plugin could pass `../../secrets` to escape the vault; added `validateVaultPath()` that rejects `..`, absolute, and Windows drive-letter paths
- [x] Fixed: Event name validation missing on `events.on` — `events.emit` validated event names against `[a-zA-Z0-9:._-]+` but `events.on` did not; added matching validation
- [x] Fixed: `discoverPlugins` called `loadPlugin()` without `await` — plugin load errors were silently swallowed as unhandled promise rejections; now properly awaited with try/catch

### Deferred Items

- [ ] Deferred: Sandbox bootstrap `addSidebarPanel(id, component)` sends only the id to the host RPC, but the host-side destructures `{ id, html }` from `args[0]` — the sidebar panel API contract between sandbox and host is inconsistent; fixing requires coordinated changes to the sandbox bootstrap JS string, the RPC handler, and the types (added to deferred-risky-items.md)
- [ ] Deferred: `ui.removeCommand` is unimplemented — commands can be added but not individually removed at runtime; the cleanup-on-destroy path works, but runtime removal requires command registry changes (added to deferred-risky-items.md)
- [ ] Deferred: Plugin settings RPC (`settings.get`/`settings.set`) has no permission gate — any plugin can read/write its own settings without declaring a permission; adding a new permission type would be a breaking API change (added to deferred-risky-items.md)
- [ ] Deferred: Registry fetch (`plugin-registry.ts`) does not validate individual plugin/theme objects from JSON — malformed entries with missing fields are cast via `as RegistryPlugin` without runtime checks (added to deferred-risky-items.md)

## Security Assessment

**Strengths:**
- Iframe sandbox with `allow-scripts` only — no DOM access, no same-origin, no popups
- Nonce-based message authentication prevents rogue iframes from injecting messages
- Plugin ID validation with strict `[a-zA-Z0-9_-]+` regex
- Entrypoint path traversal prevention in `discoverPlugins`
- SHA-256 integrity verification on plugin download
- Post-install integrity verification before load
- Explicit user confirmation dialog before executing any plugin code
- Permission checks on all RPC methods that access vault/editor/UI

**Areas of note:**
- `postMessage` uses `'*'` targetOrigin (necessary for srcdoc iframes with opaque origins — documented in code)
- Settings path uses pluginId which is already validated, so settings path injection is not possible

## User Experience Assessment

- Plugins can be discovered, installed (with SHA-256 verification), enabled, disabled, loaded, and unloaded
- Plugin load errors are captured in the `error` field and do not crash the app
- 10-second timeout prevents hung plugins from blocking forever
- `destroy()` performs thorough cleanup of event listeners, commands, status bar items, sidebar panels, and all registered UI elements
- User gets a confirmation dialog with permission list before any plugin code executes
