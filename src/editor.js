// editor.js — Edit mode: turn a column into a fast text editor

import {
  getColumnTasks,
  replaceColumnTasks,
  getSelectedPath,
  subscribe
} from './store.js';
import { render as renderColumns } from './columns.js';

let currentEditColumn = null;
let currentParentId = null;
let editorOverlay = null;

export function isEditing() {
  return currentEditColumn !== null;
}

export function enterEditMode(columnIndex, parentId) {
  if (isEditing()) exitEditMode();

  currentEditColumn = columnIndex;
  currentParentId = parentId;

  const tasks = getColumnTasks(columnIndex);
  const text = tasks.map(t => t.text).join('\n');

  // Create overlay
  editorOverlay = document.createElement('div');
  editorOverlay.className = 'editor-overlay';

  const editorPanel = document.createElement('div');
  editorPanel.className = 'editor-panel';

  const header = document.createElement('div');
  header.className = 'editor-header';
  header.innerHTML = `
    <span class="editor-title">Edit Mode</span>
    <span class="editor-hint">One task per line · Escape to save & close</span>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'editor-close-btn';
  closeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  closeBtn.addEventListener('click', () => exitEditMode());
  header.appendChild(closeBtn);

  const textarea = document.createElement('textarea');
  textarea.className = 'editor-textarea';
  textarea.value = text;
  textarea.placeholder = 'Type one task per line…';
  textarea.spellcheck = false;

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      exitEditMode();
    }
    e.stopPropagation(); // prevent global shortcuts
  });

  // Auto-resize
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  editorPanel.appendChild(header);
  editorPanel.appendChild(textarea);
  editorOverlay.appendChild(editorPanel);

  // Click outside to close
  editorOverlay.addEventListener('click', (e) => {
    if (e.target === editorOverlay) exitEditMode();
  });

  document.body.appendChild(editorOverlay);

  // Focus and auto-resize
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.style.height = textarea.scrollHeight + 'px';
    editorOverlay.classList.add('visible');
  });
}

export function exitEditMode() {
  if (!editorOverlay) return;

  const textarea = editorOverlay.querySelector('.editor-textarea');
  if (textarea) {
    const lines = textarea.value
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    replaceColumnTasks(currentParentId, lines);
  }

  editorOverlay.classList.remove('visible');
  setTimeout(() => {
    if (editorOverlay && editorOverlay.parentNode) {
      editorOverlay.parentNode.removeChild(editorOverlay);
    }
    editorOverlay = null;
    currentEditColumn = null;
    currentParentId = null;
    renderColumns();
  }, 200);
}
