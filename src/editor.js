// editor.js — Inline single-task editor state

import { render } from './columns.js';
import { updateTaskText, setTaskDate } from './store.js';
import { extractDateFromText } from './dates.js';

let editingTaskId = null;
let pendingCursorMode = 'end'; // 'start' | 'end'

export function isEditing() { return editingTaskId !== null; }
export function getEditingTaskId() { return editingTaskId; }
export function getPendingCursorMode() { return pendingCursorMode; }

export function startInlineEdit(taskId, cursorMode = 'end') {
  editingTaskId = taskId;
  pendingCursorMode = cursorMode;
  render(true); // force past the isEditing guard so the input appears
  requestAnimationFrame(() => {
    const input = document.querySelector('.task-inline-input');
    if (!input) return;
    input.focus();
    const len = input.value.length;
    const pos = cursorMode === 'start' ? 0 : len;
    input.setSelectionRange(pos, pos);
  });
}

export function stopInlineEdit() {
  if (!editingTaskId) return;
  const input = document.querySelector('.task-inline-input');
  const rawValue = input ? input.value : null;
  const id = editingTaskId;
  editingTaskId = null;
  if (rawValue !== null) {
    const { cleanText, date } = extractDateFromText(rawValue);
    const finalText = cleanText.trim() || 'Untitled';
    updateTaskText(id, finalText);   // emit() triggers subscribed render()
    if (date !== undefined) setTaskDate(id, date);
  } else {
    render(); // no mutation; manually re-render to remove input
  }
}

export function cancelInlineEdit() {
  editingTaskId = null;
  render(); // isEditing() is now false, passes guard normally
}
