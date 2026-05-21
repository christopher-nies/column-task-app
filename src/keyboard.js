// keyboard.js — Global keyboard shortcut handler (Vim-style)

import {
  moveFocusUp,
  moveFocusDown,
  drillIn,
  drillOut,
  toggleFocusedDone,
  deleteFocusedTask,
  addChildToFocused,
  getFocusedColumn,
  getFocusedIndex,
  getFocusedTaskId,
  setFocusedIndex
} from './columns.js';

import { isEditing, startInlineEdit } from './editor.js';
import { getSelectedPath, moveTask, getColumnTasks, addTask } from './store.js';
import { isSettingsOpen, closeSettings } from './settings.js';
import { openImportExport, closeImportExport, isImportExportOpen } from './importExport.js';
import { printTasks } from './print.js';

// dd state — two d-presses within 600ms triggers delete
let dPending = false;
let dTimer = null;

export function initKeyboard() {
  document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
  // Close import/export panel on Escape first
  if (e.key === 'Escape' && isImportExportOpen()) {
    e.preventDefault();
    closeImportExport();
    return;
  }

  // Close settings panel on Escape
  if (e.key === 'Escape' && isSettingsOpen()) {
    e.preventDefault();
    closeSettings();
    return;
  }

  // Let the inline input's own keydown handler take over while editing
  if (isEditing()) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const col = getFocusedColumn();
  const idx = getFocusedIndex();

  switch (e.key) {
    // ── Navigation ────────────────────────────────────────
    case 'k':
    case 'ArrowUp':
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const tasks = getColumnTasks(col);
        if (tasks[idx]) moveTask(tasks[idx].id, -1);
      } else {
        moveFocusUp();
      }
      break;

    case 'j':
    case 'ArrowDown':
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const tasks = getColumnTasks(col);
        if (tasks[idx]) moveTask(tasks[idx].id, 1);
      } else {
        moveFocusDown();
      }
      break;

    case 'l':
    case 'ArrowRight':
    case 'Enter':
      e.preventDefault();
      drillIn();
      break;

    case 'h':
    case 'ArrowLeft':
    case 'Backspace':
      e.preventDefault();
      drillOut();
      break;

    // ── Done toggle ───────────────────────────────────────
    case ' ':
      e.preventDefault();
      toggleFocusedDone();
      break;

    // ── Inline edit ───────────────────────────────────────
    case 'i': {
      e.preventDefault();
      const taskId = getFocusedTaskId();
      if (taskId) startInlineEdit(taskId, 'start');
      break;
    }

    case 'a': {
      e.preventDefault();
      const taskId = getFocusedTaskId();
      if (taskId) startInlineEdit(taskId, 'end');
      break;
    }

    // ── Add child (subtask) ───────────────────────────────
    case 'Tab': {
      e.preventDefault();
      addChildToFocused();
      break;
    }

    // ── New task + immediate edit ─────────────────────────
    case 'o': {
      if (e.ctrlKey || e.metaKey) break;
      e.preventDefault();
      const path = getSelectedPath();
      const parentId = col > 0 ? path[col - 1] : null;
      const insertIndex = idx + 1;
      const node = addTask(parentId, '', insertIndex);
      setFocusedIndex(insertIndex);
      startInlineEdit(node.id, 'start');
      break;
    }

    case 'O': {
      e.preventDefault();
      const path = getSelectedPath();
      const parentId = col > 0 ? path[col - 1] : null;
      const node = addTask(parentId, '', idx);
      // focusedIndex stays at idx — the new task landed there
      startInlineEdit(node.id, 'start');
      break;
    }

    // ── Delete (dd — double press within 600ms) ───────────
    case 'd': {
      e.preventDefault();
      if (dPending) {
        clearTimeout(dTimer);
        dPending = false;
        dTimer = null;
        deleteFocusedTask();
      } else {
        dPending = true;
        dTimer = setTimeout(() => { dPending = false; dTimer = null; }, 600);
      }
      break;
    }

    default:
      // Ctrl/Cmd+M — open import/export
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        openImportExport();
      }
      // Ctrl/Cmd+Shift+P — print task cards
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        printTasks();
      }
      break;
  }
}
