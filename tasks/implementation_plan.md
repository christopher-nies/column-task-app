# Column Task App — Implementation Plan

A web app inspired by [Colonnes](https://www.colonnes.com/) that replaces overwhelming task trees with **focused columns**. Selecting a task reveals its children in the next column to the right. Tasks are broken down until they are truly atomic.

![Colonnes concept](/home/chris/.gemini/antigravity/brain/e4faba45-d957-44d7-bfc5-70d6d64981d7/uploaded_image_1773677540543.png)

## Core Concepts (from research)

| Concept | Description |
|---|---|
| **Column view** | Hierarchical tasks shown as side-by-side columns (like macOS Finder). Only the current path is visible — no overwhelming tree. |
| **Atomic task** | A leaf node — has a checkbox (done/not done) and text. No extra metadata. |
| **Task group** | A node with children — shows a progress ring/bar instead of a checkbox. |
| **Selection mode** | Navigate tasks, select them to drill down, mark them done. |
| **Edit mode** | Turn a column into a fast text editor — one line = one task. Add/remove tasks at typing speed. |
| **Keyboard-first** | Full keyboard navigation for speed. |
| **Minimal metadata** | No dates, tags, or reminders. Less metadata → more action. |
| **Strong feedback** | Animations on completion, visible progress, satisfying interactions. |

## User Review Required

> [!IMPORTANT]
> This plan builds a **web app** using Vite + vanilla JS (no framework). If you'd prefer React, Svelte, or another framework, let me know before I proceed.

> [!IMPORTANT]
> The receipt printer integration from the original Colonnes app is **out of scope** for this initial build. We can add it later. The focus is on the column-based UI, task management, and keyboard-first experience.

## Proposed Changes

### Project Scaffolding

#### [NEW] Vite project in `/home/chris/Documents/repos/column-task-app`

- Initialize with `npx create-vite@latest ./ --template vanilla`
- Structure:
  ```
  column-task-app/
  ├── index.html
  ├── src/
  │   ├── main.js          # Entry point, app initialization
  │   ├── store.js          # Data model & state management
  │   ├── columns.js        # Column rendering & navigation
  │   ├── editor.js         # Edit mode (inline text editing)
  │   ├── keyboard.js       # Keyboard shortcut handler
  │   └── animations.js     # Completion & transition animations
  ├── style.css             # Global styles & design system
  ├── package.json
  └── vite.config.js
  ```

---

### Data Model — `store.js`

#### [NEW] [store.js](file:///home/chris/Documents/repos/column-task-app/src/store.js)

A recursive tree structure stored in-memory and persisted to `localStorage`.

```js
// Task node shape
{
  id: "uuid",
  text: "Book flights",
  done: false,           // only for leaf (atomic) tasks
  children: [],          // if non-empty → task group
  collapsed: false,      // future use
}
```

Key functions:
- `createTask(parentId, text)` — add a child task
- `deleteTask(id)` — remove a task and its subtree
- `updateTask(id, updates)` — rename, toggle done
- `moveTask(id, direction)` — reorder within siblings
- `getPath(id)` — returns array of ancestor IDs (for column rendering)
- `getProgress(id)` — recursively computes done/total for task groups
- `save()` / `load()` — localStorage serialization

---

### Column UI — `columns.js`

#### [NEW] [columns.js](file:///home/chris/Documents/repos/column-task-app/src/columns.js)

The heart of the app. Renders N columns based on the currently selected path.

**Rendering logic:**
1. Column 0 = root-level tasks
2. When a task is selected, its children render in Column 1
3. When a child is selected in Column 1, its children render in Column 2
4. And so on...

**Each task item shows:**
- Atomic task → checkbox + text
- Task group → progress indicator (ring or bar) + text + "▸" chevron
- Selected state → highlighted background
- Done state → strikethrough + dimmed

**Column transitions:**
- New columns slide in from the right
- Removed columns slide out to the right
- Smooth CSS transitions

---

### Edit Mode — `editor.js`

#### [NEW] [editor.js](file:///home/chris/Documents/repos/column-task-app/src/editor.js)

When the user presses `E` or double-clicks a column header, that column enters edit mode:
- Each task becomes a text input (or the column becomes a `<textarea>` where each line = a task)
- Adding a new line = adding a new task
- Deleting a line = deleting the task
- Press `Escape` or click outside to exit edit mode and sync changes back to the store

---

### Keyboard Navigation — `keyboard.js`

#### [NEW] [keyboard.js](file:///home/chris/Documents/repos/column-task-app/src/keyboard.js)

| Key | Action |
|---|---|
| `↑` / `↓` | Move selection within current column |
| `→` / `Enter` | Drill into selected task (show children) |
| `←` / `Backspace` | Go back to parent column |
| `Space` | Toggle done status (atomic tasks only) |
| `E` | Enter edit mode on current column |
| `Escape` | Exit edit mode |
| `N` | Add new task in current column |
| `Delete` | Delete selected task |
| `Ctrl+↑` / `Ctrl+↓` | Reorder task within column |
| `Tab` | Indent task (make it a child of the task above) |

---

### Entry Point — `main.js`

#### [NEW] [main.js](file:///home/chris/Documents/repos/column-task-app/src/main.js)

- Load saved state from localStorage (or initialize with sample data)
- Mount the column renderer
- Register keyboard handlers
- Auto-save on every state change

---

### Animations — `animations.js`

#### [NEW] [animations.js](file:///home/chris/Documents/repos/column-task-app/src/animations.js)

- Task completion: brief check-mark burst animation + strikethrough sweep
- Column slide-in/out transitions
- Progress ring fill animation
- Subtle hover/focus effects

---

### Styles — `style.css`

#### [NEW] [style.css](file:///home/chris/Documents/repos/column-task-app/style.css)

Design system:
- **Dark mode** as default with optional light mode
- Clean, monochrome palette with subtle accent colors
- `Inter` or `Outfit` font from Google Fonts
- Column cards with subtle borders and background differentiation
- Smooth transitions on all interactive elements
- Glassmorphism effects on column headers
- Mobile-responsive: columns stack vertically or scroll horizontally

---

### HTML — `index.html`

#### [MODIFY] [index.html](file:///home/chris/Documents/repos/column-task-app/index.html)

- Minimal shell: app container, no visible chrome
- SEO meta tags, proper title
- Google Fonts link
- Container div `#app` for JS to mount into

---

## Verification Plan

### Browser Testing (automated via browser subagent)

1. **Start dev server**: `npm run dev` in the project directory
2. **Column navigation test**:
   - Verify root tasks render in column 0
   - Click a task group → verify children appear in column 1
   - Click a child → verify grandchildren appear in column 2
3. **Task completion test**:
   - Click checkbox on an atomic task → verify it marks as done
   - Verify parent task group progress updates
4. **Edit mode test**:
   - Double-click column header or press `E` → verify column enters edit mode
   - Type a new task name → press Enter → verify new task is created
   - Press Escape → verify exit from edit mode
5. **Keyboard navigation test**:
   - Use arrow keys to move selection
   - Press Space to toggle done
   - Press Enter to drill into a task group
6. **Persistence test**:
   - Add tasks, reload the page, verify tasks are still there

### Manual Verification (user)

- Does the app **feel fast and responsive**?
- Is the column navigation intuitive?
- Does the keyboard-first experience feel natural?
- Are the animations smooth and non-distracting?
