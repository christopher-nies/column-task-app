# AGENT.md — Column Task App

This file is the onboarding guide for any AI agent working on this codebase. Read it fully before making changes.

---

## Project Purpose

A keyboard-first, column-based task manager inspired by [Colonnes](https://www.colonnes.com/).

The core idea: instead of showing an overwhelming tree of tasks, show only the **current path** as side-by-side columns — like macOS Finder. Selecting a task group reveals its children in the next column to the right. Tasks are broken down until they are truly **atomic** (leaf nodes with a checkbox). No dates, no tags, no priorities. Less metadata → more action.

---

## Core Design Principles

These are invariants. Do not violate them.

| Principle | Rule |
|---|---|
| **No metadata** | Tasks have only `text`, `done`, and `children`. No dates, tags, priorities, reminders, or assignees. |
| **Atomic tasks are leaf nodes** | A task with `children.length > 0` is a **task group** and gets a progress ring. A task with no children is an **atomic task** and gets a checkbox. Never mix these. |
| **Keyboard-first** | Every action that exists must remain reachable by keyboard. Mouse is secondary. |
| **No framework** | Vanilla JS ES modules only. No React, Vue, Svelte, or any UI framework. No component libraries. |
| **Strong feedback** | Completions animate. Progress is always visible. Interactions feel satisfying. Don't remove animations. |
| **Receipt printer: out of scope** | The original Colonnes app prints to a receipt printer. This feature is explicitly deferred — do not add it. |

---

## File Map

```
column-task-app/
├── index.html              # Minimal HTML shell — just <div id="app"> and script tag
├── style.css               # All styles. Design system via CSS variables. Dark mode default.
├── vite.config.js          # Vite config — proxies /api/* to Express on :3000 during dev
├── package.json            # Scripts: dev, server, dev:full, build, start
├── Dockerfile              # Two-stage build: Vite builder → Node production image
├── docker-compose.yml      # Single service, port 3000, named volume for SQLite data
├── .dockerignore
├── src/                    # Frontend — Vite-bundled, vanilla JS ES modules
│   ├── main.js             # Entry point. async init() — awaits load() before first render.
│   ├── store.js            # ALL app state + mutations. Persists via REST API (SQLite).
│   ├── columns.js          # DOM rendering + focus/selection UI state. The largest module.
│   ├── editor.js           # Edit mode overlay (textarea → bulk task edit).
│   ├── keyboard.js         # Global keydown handler. Delegates to columns.js + editor.js.
│   └── animations.js       # Completion burst particles + column slide-in helpers.
├── server/                 # Backend — Node.js, runs on :3000
│   ├── index.js            # Express server. Serves dist/ + /api/state GET & PUT routes.
│   └── db.js               # better-sqlite3 layer. loadState() / saveState(). DATA_DIR env var.
├── data/                   # SQLite database file (gitignored, mounted as Docker volume)
└── tasks/
    ├── task.md             # Build checklist
    └── implementation_plan.md  # Full architecture design doc
```

### Key entry points by file

| File | Key exports / functions |
|---|---|
| `store.js` | `getState`, `getColumnTasks`, `selectTask`, `addTask`, `deleteTask`, `updateTaskText`, `toggleTaskDone`, `moveTask`, `indentTask`, `replaceColumnTasks`, `subscribe`, `save`, `load` |
| `columns.js` | `initColumns`, `render`, `moveFocusUp`, `moveFocusDown`, `drillIn`, `drillOut`, `toggleFocusedDone`, `deleteFocusedTask`, `addTaskToFocusedColumn`, `getFocusedColumn`, `getFocusedIndex` |
| `editor.js` | `enterEditMode(columnIndex, parentId)`, `exitEditMode`, `isEditing` |
| `keyboard.js` | `initKeyboard` (registers global keydown listener) |
| `animations.js` | `playCompleteAnimation(element)`, `animateColumnSlideIn(columnElement)` |

---

## Data Model

All state lives in `store.js`. It is a single module-scoped object:

```js
let state = {
  root: [],        // Task[] — top-level task nodes
  selectedPath: [] // string[] — array of selected task IDs forming the drill-down path
}
```

### Task node shape

```js
{
  id: "uuid",       // string — crypto.randomUUID() or fallback
  text: "...",      // string — display text, trimmed
  done: false,      // boolean — only meaningful on atomic tasks (leaf nodes)
  children: []      // Task[] — if non-empty, this is a task group; if empty, it's atomic
}
```

### selectedPath

`selectedPath` is an array of task IDs representing the current drill-down. It drives which columns are visible:

- `selectedPath = []` → 1 column (root tasks only)
- `selectedPath = ["abc"]` → 2 columns if `abc` has children (root + abc's children)
- `selectedPath = ["abc", "def"]` → 3 columns if `def` has children

Column index `N` shows the children of `selectedPath[N-1]`. Column 0 always shows `state.root`.

---

## Module Interaction Flow

```
User input (keyboard / click)
        │
        ▼
  keyboard.js (keydown)
  columns.js (click handlers)
        │
        ▼ calls mutation
  store.js  ──── emit() ────► save() — debounced 300ms → PUT /api/state
        │                         │                            │
        │                         ▼ notifies listeners    server/index.js
        │                   render() in columns.js        server/db.js → SQLite
        │
        └── UI state (focusedColumn, focusedIndex)
            lives in columns.js module scope
            NOT in the store

On startup (main.js init):
  GET /api/state → 200 { root, selectedPath } → load into state → render()
                 → 204 (no data)              → loadSampleData()  → render()
```

### Critical: the render guard

`columns.js:render()` returns early if `isEditing()` is true (`columns.js:35`).

During edit mode, the editor overlay owns the DOM. Do not call `render()` while editing. The guard handles this automatically, but be aware if you're adding new paths that trigger render.

### Critical: replaceColumnTasks is position-based

`store.js:replaceColumnTasks` (`store.js:239`) matches existing tasks by **array index**, not by ID or text. It overwrites `text` on existing nodes (preserving their `id` and `children`) and appends new nodes. Shrinking the array drops tasks from the end. This is intentional — bulk edit is fast, not surgically precise.

---

## Keyboard Shortcuts

Defined in `keyboard.js`. These are the full set of shortcuts:

| Key | Action | Handler |
|---|---|---|
| `↑` | Move focus up within column | `moveFocusUp()` |
| `↓` | Move focus down within column | `moveFocusDown()` |
| `→` or `Enter` | Drill into selected task (open children) | `drillIn()` |
| `←` or `Backspace` | Go back to parent column | `drillOut()` |
| `Space` | Toggle done on focused task | `toggleFocusedDone()` |
| `E` | Enter edit mode on focused column | `enterEditMode(col, parentId)` |
| `Escape` | Exit edit mode (saves changes) | `exitEditMode()` |
| `N` | Add new task in focused column | `addTaskToFocusedColumn()` |
| `Delete` | Delete focused task and its subtree | `deleteFocusedTask()` |
| `Ctrl+↑` | Reorder focused task upward | `moveTask(id, -1)` |
| `Ctrl+↓` | Reorder focused task downward | `moveTask(id, 1)` |

Keyboard handler is blocked entirely when `isEditing()` returns true, or when an `<input>` / `<textarea>` is focused.

---

## Dev Commands

```bash
# Development — run both Vite (port 5173) and Express API (port 3000) together
npm run dev:full

# Or run them separately in two terminals:
npm run dev       # Vite frontend with hot reload (proxies /api to :3000)
npm run server    # Express + SQLite backend

# Production build → dist/
npm run build

# Run production server (serves dist/ + /api)
npm start

# Docker
docker compose up --build        # Build image and start on port 3000
docker compose up -d             # Detached (background)
docker compose down              # Stop
```

**API endpoints** (`server/index.js`):

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/state` | Load full task tree. 200 + JSON, or 204 if no data yet. |
| `PUT` | `/api/state` | Save full task tree. Body: `{ root, selectedPath }`. |

No test runner is currently configured. Verification is manual browser testing (see `tasks/implementation_plan.md` → Verification Plan).

---

## Implementation Status

| Task | Status |
|---|---|
| Set up project (Vite + vanilla JS) | Done |
| Build the data model (`store.js`) | Done |
| Build the column-based UI (`columns.js`) | Done |
| Implement selection mode | Done |
| Implement edit mode (`editor.js`) | Done |
| Task completion & progress indicators | Done |
| Keyboard navigation (`keyboard.js`) | Done |
| Persistence (localStorage → REST API) | Done |
| Polish UI (animations, dark mode, responsive) | Done |
| Express + SQLite backend (`server/`) | Done |
| Docker + docker-compose | Done |
| Manual browser testing of core flows | **Pending** |
| Verify data persistence across reloads | **Pending** |

---

## Working Guidelines for Agents

### Before making changes

1. Read the relevant source file(s) in full before editing — do not guess at structure.
2. Understand which module owns the concern you're changing. State mutations belong in `store.js`. Rendering belongs in `columns.js`. Do not mix them.
3. If adding a new keyboard shortcut, add it to `keyboard.js` AND update the shortcuts hint in `main.js` (the header bar) AND the table in this file.

### State mutations

- All mutations must go through the exported functions in `store.js`. Never mutate `state` directly from another module.
- Every mutation calls `emit()` internally, which triggers a debounced `save()` (PUT /api/state) and notifies all render listeners. You do not need to call `save()` or `render()` manually after a mutation.

### Rendering

- `render()` is a full DOM teardown and rebuild — it is not diffed. This is intentional and keeps the code simple.
- Do not cache DOM element references across renders. Re-query after each render cycle.
- `focusedColumn` and `focusedIndex` (in `columns.js` module scope) must be kept valid after mutations that remove tasks. See `deleteFocusedTask` for the pattern.

### Edit mode

- `isEditing()` is the guard for all keyboard shortcuts and renders. Always check it before any action that would conflict with an active textarea.
- `exitEditMode()` saves the textarea content back to the store via `replaceColumnTasks`, then calls `renderColumns()`. It does not emit an extra event — the store mutation handles that.

### Adding new features

- New UI state (hover, focus, animation flags) belongs in module scope of `columns.js` or the relevant module — not in the store.
- New persistent state (anything the user would want to survive a page reload) belongs in `store.js`. Because save/load now go through the REST API, no schema migration is needed — state is stored as a single JSON blob in SQLite.
- If you add a new API route, add it to `server/index.js` and document it in the API table above. **Express 5 note:** wildcard catch-all routes must use named params — `'/{*splat}'` not `'*'` (the latter throws a `PathError` at startup).
- Dark mode is the default and only theme. Do not add a light mode toggle without user instruction.

### Persistence notes

- `save()` in `store.js` is **debounced 300ms** — rapid mutations (e.g. reordering tasks) collapse into a single PUT request.
- The SQLite database is stored at `DATA_DIR/tasks.db`. In Docker this is a named volume (`task_data`). Locally it defaults to `./data/tasks.db`.
- `save()` failures are silent (console.warn only) — the app continues to work, data just won't persist until the server is reachable again.
- `load()` is async and is awaited in `main.js` before first render. If the server is unreachable at startup, the app falls back to sample data.
