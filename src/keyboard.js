// keyboard.js — Global keyboard shortcut handler

import {
  moveFocusUp,
  moveFocusDown,
  drillIn,
  drillOut,
  toggleFocusedDone,
  deleteFocusedTask,
  addTaskToFocusedColumn,
  getFocusedColumn,
  render
} from './columns.js';

import { enterEditMode, isEditing } from './editor.js';
import { getSelectedPath, moveTask, getColumnTasks } from './store.js';
import { getFocusedIndex } from './columns.js';
import { isSettingsOpen, closeSettings } from './settings.js';
import { openImportExport, closeImportExport, isImportExportOpen } from './importExport.js';
import { printTasks } from './print.js';

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

  // Don't handle if we're in edit mode or an input is focused
  if (isEditing()) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const col = getFocusedColumn();
  const idx = getFocusedIndex();

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Reorder task up
        const tasks = getColumnTasks(col);
        if (tasks[idx]) moveTask(tasks[idx].id, -1);
      } else {
        moveFocusUp();
      }
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Reorder task down
        const tasks = getColumnTasks(col);
        if (tasks[idx]) moveTask(tasks[idx].id, 1);
      } else {
        moveFocusDown();
      }
      break;

    case 'ArrowRight':
      e.preventDefault();
      drillIn();
      break;

    case 'ArrowLeft':
    case 'Backspace':
      e.preventDefault();
      drillOut();
      break;

    case 'Enter':
      e.preventDefault();
      drillIn();
      break;

    case ' ':
      e.preventDefault();
      toggleFocusedDone();
      break;

    case 'e':
    case 'E':
      e.preventDefault();
      const path = getSelectedPath();
      const parentId = col > 0 ? path[col - 1] : null;
      enterEditMode(col, parentId);
      break;

    case 'n':
    case 'N':
      e.preventDefault();
      addTaskToFocusedColumn();
      break;

    case 'Delete':
      e.preventDefault();
      deleteFocusedTask();
      break;

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
