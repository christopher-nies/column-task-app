# Columns

A keyboard-first, column-based task manager inspired by [Colonnes](https://www.colonnes.com/) and macOS Finder's column view.

Instead of a flat list or tree, Columns reveals only your current navigation path as side-by-side columns. Selecting a task group opens its children in the next column to the right. Tasks drill down until they are atomic (leaf nodes with a checkbox). Parent task groups display a circular SVG progress ring.

**Design philosophy: radical minimalism.** Tasks have only three fields: `text`, `done`, and `children`. No dates, tags, priorities, or assignees. Dark mode only.

## Features

- Column-based drill-down navigation (macOS Finder style)
- Task groups with animated SVG progress rings
- Atomic tasks with checkboxes and particle burst animations on completion
- Keyboard-first — full shortcut set, no mouse required
- Bulk edit mode (`E`) — edit an entire column as plain text
- Task reordering (`Ctrl+↑/↓`), indent/unindent, add, delete
- Persistent state via a REST API backed by SQLite
- Settings panel (toggle showing undone count inside progress rings)
- Docker support for self-hosting

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (ES modules, no framework) |
| Bundler | Vite |
| Backend | Node.js + Express 5 |
| Database | SQLite via `better-sqlite3` |
| Styling | Plain CSS with CSS custom properties |
| Containerization | Docker + Docker Compose |

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Install dependencies

```bash
npm install
```

### Run in development

Starts Vite (port 5173) and Express (port 3000) concurrently:

```bash
npm run dev:full
```

Then open [http://localhost:5173](http://localhost:5173).

You can also run the frontend and backend separately:

```bash
npm run dev     # Vite frontend only (proxies /api to :3000)
npm run server  # Express backend only
```

### Build for production

```bash
npm run build
npm start
```

The app will be served on port 3000.

## Docker

```bash
# Build and start
docker compose up --build

# Run in background
docker compose up -d

# Stop
docker compose down
```

The app is available on port 3000. Task data is persisted in a named Docker volume (`task_data`).

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Express server port |
| `DATA_DIR` | `./data` | Directory for the SQLite database file |

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/state` | Returns `{ root, selectedPath }` (204 if no data yet) |
| `PUT` | `/api/state` | Saves `{ root, selectedPath }` |

State is saved automatically with a 300ms debounce on every change.

## Data Model

```js
Task = {
  id: string,       // crypto.randomUUID()
  text: string,
  done: boolean,    // relevant only on leaf/atomic tasks
  children: Task[]  // non-empty → task group; empty → atomic task
}
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate tasks in current column |
| `←` / `→` | Navigate between columns |
| `Enter` | Open task group / toggle checkbox |
| `N` | New task |
| `D` | Delete task |
| `E` | Bulk edit current column |
| `Ctrl+↑` / `Ctrl+↓` | Reorder task |
| `Tab` / `Shift+Tab` | Indent / unindent task |
| `,` | Open settings |
