// columns.js — Column-based UI rendering

import {
  getColumnTasks,
  getSelectedIdForColumn,
  selectTask,
  deselectColumn,
  isTaskGroup,
  isAtomicTask,
  getProgress,
  toggleTaskDone,
  deleteTask,
  addTask,
  getState,
  getSelectedPath,
  updateTaskText,
  reorderTask
} from './store.js';

import { enterEditMode, isEditing } from './editor.js';
import { playCompleteAnimation } from './animations.js';
import { getSettings } from './settings.js';

let columnsContainer = null;
let focusedColumn = 0;
let focusedIndex = 0;
let dragState = null;     // { taskId, columnIndex, itemIndex }
let justDroppedId = null; // task id that just landed, cleared after animation

// Track previous ring state so we can animate from old → new values
// Map<taskId, { offset: number, percent: number, remaining: number }>
const ringState = new Map();

export function getFocusedColumn() { return focusedColumn; }
export function getFocusedIndex() { return focusedIndex; }
export function setFocusedColumn(c) { focusedColumn = c; }
export function setFocusedIndex(i) { focusedIndex = i; }

export function initColumns(container) {
  columnsContainer = container;
}

export function render() {
  if (!columnsContainer || isEditing()) return;

  const state = getState();
  const path = state.selectedPath;

  // Determine how many columns to show
  let columnCount = 1; // always show root
  for (let i = 0; i < path.length; i++) {
    const tasks = getColumnTasks(i + 1);
    if (tasks.length > 0) columnCount = i + 2;
    else break;
  }

  // Track existing column elements for animation
  const existingColumns = columnsContainer.querySelectorAll('.column');
  const existingCount = existingColumns.length;

  // Build HTML
  const fragment = document.createDocumentFragment();

  for (let col = 0; col < columnCount; col++) {
    const tasks = getColumnTasks(col);
    const selectedId = getSelectedIdForColumn(col);
    const parentId = col > 0 ? path[col - 1] : null;

    const column = document.createElement('div');
    column.className = 'column';
    column.dataset.columnIndex = col;
    if (col >= existingCount) {
      column.classList.add('column-enter');
    }

    // Column header
    const header = document.createElement('div');
    header.className = 'column-header';

    if (col === 0) {
      header.innerHTML = `<span class="column-index">01</span><span class="column-title">Tasks</span>`;
    } else {
      const parentNode = getParentForColumn(col, path);
      const parentText = parentNode ? parentNode.text : '';
      const colNum = String(col + 1).padStart(2, '0');
      header.innerHTML = `<span class="column-index">${colNum}</span><span class="column-title">${escapeHtml(parentText)}</span>`;
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'column-edit-btn';
    editBtn.title = 'Edit mode (E)';
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enterEditMode(col, parentId);
    });
    header.appendChild(editBtn);

    const addBtn = document.createElement('button');
    addBtn.className = 'column-add-btn';
    addBtn.title = 'Add task (N)';
    addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const node = addTask(parentId, 'New task');
      // Select and focus the new task
      focusedColumn = col;
      focusedIndex = tasks.length; // it was appended
    });
    header.appendChild(addBtn);

    column.appendChild(header);

    // Task list
    const list = document.createElement('div');
    list.className = 'task-list';

    tasks.forEach((task, idx) => {
      const item = createTaskElement(task, col, idx, selectedId);
      list.appendChild(item);
    });

    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-column';
      empty.innerHTML = `<span class="empty-column-text">no tasks yet</span>`;
      list.appendChild(empty);
    }

    column.appendChild(list);
    fragment.appendChild(column);
  }

  columnsContainer.innerHTML = '';
  columnsContainer.appendChild(fragment);

  // Trigger enter animation
  requestAnimationFrame(() => {
    columnsContainer.querySelectorAll('.column-enter').forEach(col => {
      col.classList.remove('column-enter');
    });
  });

  // Scroll to show the rightmost column
  requestAnimationFrame(() => {
    const lastCol = columnsContainer.querySelector('.column:last-child');
    if (lastCol) {
      lastCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
    }
  });

  // Update focus indicator
  updateFocusIndicator();

  // Animate progress rings from previous state
  animateProgressRings();
}

function createTaskElement(task, columnIndex, itemIndex, selectedId) {
  const item = document.createElement('div');
  item.className = 'task-item';
  item.dataset.taskId = task.id;
  item.dataset.columnIndex = columnIndex;
  item.dataset.itemIndex = itemIndex;

  if (task.id === selectedId) item.classList.add('selected');
  if (task.done) item.classList.add('done');
  if (focusedColumn === columnIndex && focusedIndex === itemIndex) {
    item.classList.add('focused');
  }
  if (task.id === justDroppedId) item.classList.add('just-landed');

  const group = isTaskGroup(task);

  // Left side: checkbox or progress
  const indicator = document.createElement('div');
  indicator.className = 'task-indicator';

  if (group) {
    const progress = getProgress(task);
    const remaining = progress.total - progress.done;
    indicator.innerHTML = createProgressRing(progress.percent, 18, remaining);
    // Store progress metadata on the SVG for the animation pass
    const svg = indicator.querySelector('.progress-ring');
    if (svg) {
      svg.dataset.taskId = task.id;
      svg.dataset.percent = progress.percent;
      svg.dataset.remaining = remaining;
    }
    indicator.title = `${progress.done}/${progress.total} done`;
    indicator.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskDone(task.id);
    });
  } else {
    const checkbox = document.createElement('div');
    checkbox.className = `task-checkbox ${task.done ? 'checked' : ''}`;
    if (task.done) {
      checkbox.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskDone(task.id);
      if (!task.done) { // was not done, now will be
        playCompleteAnimation(item);
      }
    });
    indicator.appendChild(checkbox);
  }

  item.appendChild(indicator);

  // Text
  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;
  item.appendChild(text);

  // Chevron for groups
  if (group) {
    const chevron = document.createElement('span');
    chevron.className = 'task-chevron';
    chevron.innerHTML = '›';
    item.appendChild(chevron);
  }

  // Click handler
  item.addEventListener('click', () => {
    focusedColumn = columnIndex;
    focusedIndex = itemIndex;
    selectTask(task.id, columnIndex);
    if (group) {
      focusedColumn++;
      focusedIndex = 0;
    }
  });

  // Drag and drop — item itself moves, idle items slide out of the way
  item.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.task-checkbox, .task-indicator, button')) return;

    const startY = e.clientY;
    const columnEl = columnsContainer.querySelector(`.column[data-column-index="${columnIndex}"]`);
    const allItems = [...columnEl.querySelectorAll('.task-item')];
    const myIdx = allItems.indexOf(item);
    if (myIdx === -1) return;

    // Snapshot vertical centers of every item before any movement
    const originalCenters = allItems.map(el => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    // Height of one slot (item height + 2px margin gap)
    const slotH = item.offsetHeight + 2;

    let active = false;
    let currentSlot = myIdx;

    const onMove = (e) => {
      const dy = e.clientY - startY;

      if (!active) {
        if (Math.abs(dy) < 6) return;
        active = true;
        dragState = { taskId: task.id, columnIndex, itemIndex };
        item.classList.add('dragging');
        item.style.zIndex = '100';
        // Prime idle items for smooth transitions
        allItems.forEach((el, i) => {
          if (i !== myIdx) {
            el.style.willChange = 'transform';
            el.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
          }
        });
      }

      // Dragged item follows cursor directly — no transition
      item.style.transform = `translateY(${dy}px)`;

      // Where is the dragged item's centre right now?
      const draggedCenter = originalCenters[myIdx] + dy;

      // Slide idle items to make room and count how many remain above
      let slot = 0;
      allItems.forEach((el, i) => {
        if (i === myIdx) return;
        const isAbove = i < myIdx;
        const center  = originalCenters[i];
        let shifted;
        if (isAbove) {
          // Originally above: slide DOWN when dragged item passes above them
          shifted = draggedCenter < center;
          el.style.transform = shifted ? `translateY(${slotH}px)` : 'translateY(0)';
          if (!shifted) slot++; // still above the dragged item
        } else {
          // Originally below: slide UP when dragged item passes below them
          shifted = draggedCenter > center;
          el.style.transform = shifted ? `translateY(-${slotH}px)` : 'translateY(0)';
          if (shifted) slot++;  // now above the dragged item
        }
      });
      currentSlot = slot;
    };

    const cleanup = () => {
      allItems.forEach(el => {
        el.style.willChange  = '';
        el.style.transition  = '';
        el.style.transform   = '';
      });
      item.classList.remove('dragging');
      item.style.zIndex    = '';
      item.style.transform = '';
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
      document.removeEventListener('pointercancel', onUp);

      if (!active) return;
      active = false;
      dragState = null;
      cleanup();

      if (currentSlot !== myIdx) {
        justDroppedId = task.id;
        setTimeout(() => { justDroppedId = null; }, 600);
        // currentSlot is the final index; translate to reorderTask's targetIndex
        const targetIndex = currentSlot > myIdx ? currentSlot + 1 : currentSlot;
        reorderTask(task.id, targetIndex);
        focusedColumn = columnIndex;
        focusedIndex  = currentSlot;
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
    document.addEventListener('pointercancel', onUp);
  });

  return item;
}

function createProgressRing(percent, size, remaining = 0) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent === 100 ? 'var(--color-success)' : 'var(--color-accent)';
  const cx = size / 2;
  const cy = size / 2;

  const { showCountInRing } = getSettings();
  const showCount = showCountInRing && remaining > 0;

  const countEl = showCount
    ? `<text x="${cx}" y="${cy}" class="progress-ring-count" dominant-baseline="middle" text-anchor="middle">${remaining}</text>`
    : '';

  return `
    <svg width="${size}" height="${size}" class="progress-ring">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--color-ring-bg)" stroke-width="2.5"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2.5"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
        class="progress-ring-fill"/>
      ${countEl}
    </svg>`;
}

function getParentForColumn(col, path) {
  if (col <= 0) return null;
  const { root } = getState();
  function find(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n;
      const f = find(n.children, id);
      if (f) return f;
    }
    return null;
  }
  return find(root, path[col - 1]);
}

function updateFocusIndicator() {
  const items = columnsContainer.querySelectorAll('.task-item');
  items.forEach(item => {
    const col = parseInt(item.dataset.columnIndex);
    const idx = parseInt(item.dataset.itemIndex);
    if (col === focusedColumn && idx === focusedIndex) {
      item.classList.add('focused');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('focused');
    }
  });
}

function animateProgressRings() {
  const rings = columnsContainer.querySelectorAll('.progress-ring[data-task-id]');

  rings.forEach(svg => {
    const taskId    = svg.dataset.taskId;
    const newPct    = parseFloat(svg.dataset.percent);
    const newRemain = parseInt(svg.dataset.remaining, 10);

    const fill = svg.querySelector('.progress-ring-fill');
    const countText = svg.querySelector('.progress-ring-count');
    if (!fill) return;

    const r            = parseFloat(fill.getAttribute('r'));
    const circumference = 2 * Math.PI * r;
    const newOffset    = circumference - (newPct / 100) * circumference;

    const prev = ringState.get(taskId);
    const oldOffset  = prev ? prev.offset  : newOffset;   // no prev → start at target (no anim on first paint)
    const oldPct     = prev ? prev.percent : newPct;
    const oldRemain  = prev ? prev.remaining : newRemain;

    const changed = oldOffset !== newOffset;
    const justCompleted = oldPct < 100 && newPct === 100;
    const countChanged  = oldRemain !== newRemain;

    // Update stored state immediately
    ringState.set(taskId, { offset: newOffset, percent: newPct, remaining: newRemain });

    if (!changed && !countChanged) return;

    const dur = 420; // ms

    // ── Arc tween ────────────────────────────────────────────
    if (changed) {
      // Determine target stroke color
      const endColor   = newPct === 100 ? '#6abf69' : '#c9a84c';  // --color-success / --color-accent
      const startColor = oldPct === 100 ? '#6abf69' : '#c9a84c';

      fill.animate(
        [
          { strokeDashoffset: oldOffset, stroke: startColor },
          { strokeDashoffset: newOffset, stroke: endColor   }
        ],
        { duration: dur, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
      );

      // ── Completion burst: scale + overshoot on the whole SVG ─
      if (justCompleted) {
        svg.animate(
          [
            { transform: 'scale(1)',    offset: 0   },
            { transform: 'scale(1.45)', offset: 0.4 },
            { transform: 'scale(0.9)',  offset: 0.7 },
            { transform: 'scale(1)',    offset: 1   }
          ],
          { duration: 550, easing: 'ease-out', fill: 'forwards' }
        );

        // Brief color-flash ring pulse
        fill.animate(
          [
            { stroke: '#6abf69', opacity: 1   },
            { stroke: '#a8f0a8', opacity: 0.9 },
            { stroke: '#6abf69', opacity: 1   }
          ],
          { duration: 500, easing: 'ease-out', fill: 'forwards', delay: 80 }
        );
      }
    }

    // ── Count text pop ────────────────────────────────────────
    if (countText && countChanged) {
      countText.animate(
        [
          { opacity: 0, transform: 'scale(0.5)' },
          { opacity: 1, transform: 'scale(1.3)' },
          { opacity: 1, transform: 'scale(1)'   }
        ],
        { duration: 320, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }
      );
    }
  });

  // Prune stale entries (tasks removed from view)
  const visibleIds = new Set([...rings].map(s => s.dataset.taskId));
  for (const id of ringState.keys()) {
    if (!visibleIds.has(id)) ringState.delete(id);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Keyboard helpers ─────────────────────────────────────

export function moveFocusUp() {
  if (focusedIndex > 0) {
    focusedIndex--;
    render();
  }
}

export function moveFocusDown() {
  const tasks = getColumnTasks(focusedColumn);
  if (focusedIndex < tasks.length - 1) {
    focusedIndex++;
    render();
  }
}

export function drillIn() {
  const tasks = getColumnTasks(focusedColumn);
  const task = tasks[focusedIndex];
  if (!task) return;

  selectTask(task.id, focusedColumn);
  if (isTaskGroup(task)) {
    focusedColumn++;
    focusedIndex = 0;
  }
}

export function drillOut() {
  if (focusedColumn > 0) {
    // Find what index the parent was at in its column
    const parentTasks = getColumnTasks(focusedColumn - 1);
    const selectedId = getSelectedIdForColumn(focusedColumn - 1);
    const parentIdx = parentTasks.findIndex(t => t.id === selectedId);

    deselectColumn(focusedColumn);
    focusedColumn--;
    focusedIndex = parentIdx >= 0 ? parentIdx : 0;
    render();
  }
}

export function toggleFocusedDone() {
  const tasks = getColumnTasks(focusedColumn);
  const task = tasks[focusedIndex];
  if (task) {
    const wasNotDone = !task.done && isAtomicTask(task);
    toggleTaskDone(task.id);
    if (wasNotDone) {
      requestAnimationFrame(() => {
        const el = columnsContainer.querySelector(`.task-item[data-task-id="${task.id}"]`);
        if (el) playCompleteAnimation(el);
      });
    }
  }
}

export function deleteFocusedTask() {
  const tasks = getColumnTasks(focusedColumn);
  const task = tasks[focusedIndex];
  if (!task) return;
  deleteTask(task.id);
  if (focusedIndex >= tasks.length - 1) {
    focusedIndex = Math.max(0, tasks.length - 2);
  }
}

export function addTaskToFocusedColumn() {
  const path = getSelectedPath();
  const focusedTask = getColumnTasks(focusedColumn)[focusedIndex];

  // If the focused task is the selected task, add as its child (even if it has no children yet)
  const lastSelectedId = path[path.length - 1];
  let parentId;
  if (focusedTask && focusedTask.id === lastSelectedId) {
    parentId = focusedTask.id;
    const node = addTask(parentId, '');
    focusedColumn++;
    focusedIndex = 0;
    requestAnimationFrame(() => {
      const el = columnsContainer.querySelector(`.task-item[data-task-id="${node.id}"] .task-text`);
      if (el) startInlineRename(node.id, el);
    });
    return;
  }

  parentId = focusedColumn > 0 ? path[focusedColumn - 1] : null;
  const node = addTask(parentId, '');
  const tasks = getColumnTasks(focusedColumn);
  focusedIndex = tasks.length - 1;

  // After render, find the new task and enable inline rename
  requestAnimationFrame(() => {
    const el = columnsContainer.querySelector(`.task-item[data-task-id="${node.id}"] .task-text`);
    if (el) startInlineRename(node.id, el);
  });
}

function startInlineRename(taskId, textEl) {
  const input = document.createElement('input');
  input.className = 'inline-rename';
  input.type = 'text';
  input.value = textEl.textContent;
  textEl.replaceWith(input);
  input.focus();

  const finish = () => {
    const newText = input.value.trim() || 'Untitled';
    updateTaskText(taskId, newText);
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); input.blur(); }
    e.stopPropagation(); // prevent keyboard shortcuts from firing
  });
}
