# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Vite + Electron hot-reload)
npm run build        # Type-check and build (tsc --noEmit && vite build)
npm run package:win  # Build + package Windows installer (NSIS)
npm run package:mac  # Build + package macOS DMG
npm run package:linux # Build + package Linux AppImage
```

There are no tests in this project.

## Architecture

Nexus Terminal is an **Electron + React** desktop app — a multi-pane terminal manager built on `node-pty` and `xterm.js`.

### Process boundary

```
Renderer (React/Vite)          Main (Electron/Node)
─────────────────────          ────────────────────
window.electronAPI  ──IPC──►  ipcMain handlers  ──►  ShellManager
(defined in preload.ts)                               (node-pty sessions)
```

- `electron/preload.ts` — defines and exposes the `ElectronAPI` interface via `contextBridge`. This is the only bridge between renderer and main; the renderer never accesses Node APIs directly.
- `electron/main.ts` — registers IPC handlers and creates the `BrowserWindow`. Frameless window (`frame: false`) with custom titlebar.
- `electron/shell-manager.ts` — owns all PTY sessions (`node-pty`). Handles profile CRUD, session lifecycle, and JSON persistence (profiles, snapshots, layouts) under Electron's `userData` directory.

### Renderer

- `src/store.ts` — Single Zustand store for all UI state: active terminals, profiles, grid layout, broadcast mode, themes, command history, saved layouts.
- `src/App.tsx` — Root component. Registers global keyboard shortcuts (Ctrl+Shift+P/N/W/B/S/1–9), restores session snapshot on startup, saves snapshot on quit.
- `src/components/TerminalPanel.tsx` — Mounts an `xterm.js` Terminal instance into the DOM. Manages FitAddon (resize), SearchAddon, WebLinksAddon. Command keystrokes are intercepted to build `commandHistory` in the store.
- `src/components/TerminalGrid.tsx` — Renders a CSS grid of terminal cells or empty slots. Supports drag-and-drop reordering between cells.
- `src/components/Sidebar.tsx` — Profiles list, active sessions, grid layout presets, saved layouts, broadcast toggle, app/terminal theme pickers.
- `src/components/CommandPalette.tsx` — Ctrl+Shift+P overlay. Searches `commandHistory` across all sessions and re-executes selected commands into the active terminal.
- `src/themes.ts` — xterm.js color theme objects (NEXUS_DARK, NEXUS_LIGHT, ONE_DARK, DRACULA, TOKYO_NIGHT, NORD).

### Theming

App-level theming uses CSS custom properties defined under `[data-theme="dark"]` / `[data-theme="light"]` in `src/index.css`. Tailwind utilities reference these via the config (e.g. `bg-app-bg`, `text-app-text`, `ring-accent`). Terminal colors are separate — xterm.js `XtermTheme` objects applied directly to the Terminal instance.

### Persistence

`ShellManager` stores three JSON files in `app.getPath('userData')`:
- `profiles.json` — user-defined shell profiles (seeded from `DEFAULT_PROFILES` on first run)
- `snapshot.json` — session state saved on quit, restored on next launch
- `layouts.json` — named grid layouts saved by the user

### Data flow summary

1. **New terminal**: Renderer calls `window.electronAPI.terminal.create(profileId, cols, rows)` → IPC → `ShellManager.createSession()` → `pty.spawn()` → returns `sessionId` → `addTerminal()` in Zustand store.
2. **PTY output**: `ptyProcess.onData` → `mainWindow.webContents.send('terminal:data', sessionId, data)` → `window.electronAPI.terminal.onData` callback → `terminal.write(data)` in xterm.js.
3. **User input**: xterm.js `onData` → `window.electronAPI.terminal.write(sessionId, data)` → IPC send → `ShellManager.write()` → `ptyProcess.write()`. In broadcast mode, input is also sent to all other running sessions.
4. **Resize**: `ResizeObserver` on the container div → `FitAddon.fit()` → `window.electronAPI.terminal.resize()` → `ShellManager.resize()` → `ptyProcess.resize()`.
