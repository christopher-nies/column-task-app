// store.js — Recursive task tree with REST API persistence (SQLite backend)

const API_BASE = '/api';

let state = {
  root: [],        // top-level task nodes
  selectedPath: [] // array of selected task IDs forming the current drill-down path
};

let listeners = [];

// ─── ID generation ────────────────────────────────────────

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Node helpers ─────────────────────────────────────────

function createNode(text) {
  return {
    id: generateId(),
    text: text.trim(),
    done: false,
    children: []
  };
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findParent(nodes, id, parent = null) {
  for (const node of nodes) {
    if (node.id === id) return parent;
    if (node.children.length > 0) {
      const found = findParent(node.children, id, node);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function getSiblings(id) {
  const parent = findParent(state.root, id);
  return parent ? parent.children : state.root;
}

// ─── Public API ───────────────────────────────────────────

export function getState() {
  return state;
}

export function getRootTasks() {
  return state.root;
}

export function getSelectedPath() {
  return [...state.selectedPath];
}

export function getTaskById(id) {
  return findNode(state.root, id);
}

export function isTaskGroup(node) {
  return node && node.children && node.children.length > 0;
}

export function isAtomicTask(node) {
  return node && (!node.children || node.children.length === 0);
}

export function getProgress(node) {
  if (!node) return { done: 0, total: 0, percent: 0 };
  if (isAtomicTask(node)) {
    return { done: node.done ? 1 : 0, total: 1, percent: node.done ? 100 : 0 };
  }
  let done = 0;
  let total = 0;
  for (const child of node.children) {
    const p = getProgress(child);
    done += p.done;
    total += p.total;
  }
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// Get the list of tasks for a specific column index based on the selected path
export function getColumnTasks(columnIndex) {
  if (columnIndex === 0) return state.root;
  const parentId = state.selectedPath[columnIndex - 1];
  if (!parentId) return [];
  const parent = findNode(state.root, parentId);
  return parent ? parent.children : [];
}

// Get the number of visible columns
export function getColumnCount() {
  // Always at least 1 (root). Plus one for each level of selection.
  // If the last selected item has children, show one more column.
  const pathLen = state.selectedPath.length;
  if (pathLen === 0) return 1;
  const lastSelected = findNode(state.root, state.selectedPath[pathLen - 1]);
  if (lastSelected && lastSelected.children.length > 0) {
    return pathLen + 1;
  }
  return pathLen;
}

// ─── Selection ────────────────────────────────────────────

export function selectTask(id, columnIndex) {
  // Trim the path to this column and set the new selection
  state.selectedPath = state.selectedPath.slice(0, columnIndex);
  state.selectedPath.push(id);
  emit();
}

export function deselectColumn(columnIndex) {
  state.selectedPath = state.selectedPath.slice(0, columnIndex);
  emit();
}

export function getSelectedIdForColumn(columnIndex) {
  return state.selectedPath[columnIndex] || null;
}

// ─── Mutations ────────────────────────────────────────────

export function addTask(parentId, text, index = -1) {
  const node = createNode(text);
  if (parentId === null) {
    if (index >= 0) {
      state.root.splice(index, 0, node);
    } else {
      state.root.push(node);
    }
  } else {
    const parent = findNode(state.root, parentId);
    if (parent) {
      if (index >= 0) {
        parent.children.splice(index, 0, node);
      } else {
        parent.children.push(node);
      }
    }
  }
  emit();
  return node;
}

export function deleteTask(id) {
  function removeFrom(list) {
    const idx = list.findIndex(n => n.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      return true;
    }
    for (const node of list) {
      if (node.children.length > 0 && removeFrom(node.children)) return true;
    }
    return false;
  }
  removeFrom(state.root);
  // Clean the selection path if the deleted task was selected
  state.selectedPath = state.selectedPath.filter(sid => findNode(state.root, sid) !== null);
  emit();
}

export function updateTaskText(id, text) {
  const node = findNode(state.root, id);
  if (node) {
    node.text = text;
    emit();
  }
}

export function toggleTaskDone(id) {
  const node = findNode(state.root, id);
  if (!node) return;
  if (isAtomicTask(node)) {
    node.done = !node.done;
  } else {
    // Toggle all descendants
    const allDone = getProgress(node).percent === 100;
    function setDone(n, val) {
      if (isAtomicTask(n)) n.done = val;
      else n.children.forEach(c => setDone(c, val));
    }
    setDone(node, !allDone);
  }
  emit();
}

export function moveTask(id, direction) {
  const siblings = getSiblings(id);
  const idx = siblings.findIndex(n => n.id === id);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= siblings.length) return;
  [siblings[idx], siblings[newIdx]] = [siblings[newIdx], siblings[idx]];
  emit();
}

export function indentTask(id) {
  // Make this task a child of the task above it
  const siblings = getSiblings(id);
  const idx = siblings.findIndex(n => n.id === id);
  if (idx <= 0) return;
  const target = siblings[idx - 1];
  const [task] = siblings.splice(idx, 1);
  target.children.push(task);
  emit();
}

export function unindentTask(id) {
  const parent = findParent(state.root, id);
  if (!parent) return; // already at root
  const grandParent = findParent(state.root, parent.id);
  const idx = parent.children.findIndex(n => n.id === id);
  const [task] = parent.children.splice(idx, 1);
  const parentSiblings = grandParent ? grandParent.children : state.root;
  const parentIdx = parentSiblings.findIndex(n => n.id === parent.id);
  parentSiblings.splice(parentIdx + 1, 0, task);
  emit();
}

// ─── Bulk edit (for edit mode) ────────────────────────────

export function replaceColumnTasks(parentId, texts) {
  const parent = parentId ? findNode(state.root, parentId) : null;
  const currentChildren = parent ? parent.children : state.root;

  // Match existing tasks by position, add/remove as needed
  const newChildren = texts.map((text, i) => {
    if (i < currentChildren.length) {
      currentChildren[i].text = text.trim();
      return currentChildren[i];
    }
    return createNode(text);
  });

  if (parent) {
    parent.children = newChildren;
  } else {
    state.root = newChildren;
  }
  emit();
}

// ─── Persistence ──────────────────────────────────────────

// Debounce saves so rapid mutations don't flood the API
let saveTimer = null;

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch(`${API_BASE}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: state.root, selectedPath: state.selectedPath })
    }).catch(e => console.warn('Failed to save state:', e));
  }, 300);
}

/**
 * Load state from the server.
 * Returns true if data was found, false if the server returned 204 (no data yet).
 */
export async function load() {
  try {
    const res = await fetch(`${API_BASE}/state`);
    if (res.status === 204) return false; // no saved state yet
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.root = data.root || [];
    state.selectedPath = data.selectedPath || [];
    return true;
  } catch (e) {
    console.warn('Failed to load state:', e);
    return false;
  }
}

export function loadSampleData() {
  state.root = [
    {
      id: generateId(),
      text: 'Clean the house',
      done: false,
      children: [
        { id: generateId(), text: 'Wash dishes', done: true, children: [] },
        { id: generateId(), text: 'Wipe down surfaces', done: false, children: [] },
        { id: generateId(), text: 'Vacuum floors', done: false, children: [] },
        { id: generateId(), text: 'Take out trash', done: false, children: [] }
      ]
    },
    {
      id: generateId(),
      text: 'Cook dinner',
      done: false,
      children: [
        { id: generateId(), text: 'Check recipe', done: false, children: [] },
        { id: generateId(), text: 'Buy ingredients', done: false, children: [] },
        { id: generateId(), text: 'Prep vegetables', done: false, children: [] },
        { id: generateId(), text: 'Cook main course', done: false, children: [] }
      ]
    },
    {
      id: generateId(),
      text: 'Plan vacation',
      done: false,
      children: [
        { id: generateId(), text: 'Research', done: false, children: [
          { id: generateId(), text: 'Compare destinations', done: false, children: [] },
          { id: generateId(), text: 'Read travel blogs', done: false, children: [] },
          { id: generateId(), text: 'Check visa requirements', done: false, children: [] }
        ]},
        { id: generateId(), text: 'Bookings', done: false, children: [
          { id: generateId(), text: 'Book flights', done: false, children: [] },
          { id: generateId(), text: 'Reserve hotel', done: false, children: [] },
          { id: generateId(), text: 'Book activities', done: false, children: [] },
          { id: generateId(), text: 'Get travel insurance', done: false, children: [] }
        ]},
        { id: generateId(), text: 'Prepare', done: false, children: [
          { id: generateId(), text: 'Pack suitcase', done: false, children: [] },
          { id: generateId(), text: 'Arrange pet care', done: false, children: [] },
          { id: generateId(), text: 'Set out-of-office', done: false, children: [] }
        ]}
      ]
    },
    {
      id: generateId(),
      text: 'Weekly workout plan',
      done: false,
      children: [
        { id: generateId(), text: 'Monday — Upper body', done: false, children: [] },
        { id: generateId(), text: 'Wednesday — Cardio', done: false, children: [] },
        { id: generateId(), text: 'Friday — Lower body', done: false, children: [] }
      ]
    }
  ];
  state.selectedPath = [];
  emit();
}

// ─── Event system ─────────────────────────────────────────

function emit() {
  save();
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
