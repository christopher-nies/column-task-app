// importExport.js — Markdown task list import / export

import { getRootTasks, importTasks } from './store.js';
import { render } from './columns.js';

// ─── Markdown serialisation ───────────────────────────────

function nodesToMarkdown(nodes, depth = 0) {
  const indent = '  '.repeat(depth);
  return nodes.map(node => {
    const checkbox = node.done ? '[x]' : '[ ]';
    const line = `${indent}- ${checkbox} ${node.text}`;
    if (node.children && node.children.length > 0) {
      return line + '\n' + nodesToMarkdown(node.children, depth + 1);
    }
    return line;
  }).join('\n');
}

function markdownToNodes(text) {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const root = [];
  // stack entries: { node, depth }
  const stack = [];

  for (const line of lines) {
    const match = line.match(/^(\s*)- \[(x| )\] (.+)$/);
    if (!match) continue;

    const depth = Math.floor(match[1].length / 2);
    const done = match[2] === 'x';
    const text = match[3].trim();

    const node = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text,
      done,
      children: []
    };

    // Pop stack until we find the right parent depth
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, depth });
  }

  return root;
}

// ─── Modal state ──────────────────────────────────────────

let overlay = null;

export function isImportExportOpen() {
  return overlay !== null;
}

export function openImportExport() {
  if (overlay) return;

  const md = nodesToMarkdown(getRootTasks());

  overlay = document.createElement('div');
  overlay.className = 'editor-overlay ie-overlay';
  overlay.innerHTML = `
    <div class="editor-panel ie-panel">
      <div class="editor-header">
        <span class="editor-title">Import / Export</span>
        <span class="editor-hint">Edit markdown · Escape or ✕ to import &amp; close</span>
        <button class="editor-close-btn ie-close-btn" title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <textarea class="editor-textarea ie-textarea" spellcheck="false" placeholder="- [ ] Task&#10;  - [ ] Child task&#10;  - [x] Done child&#10;- [x] Done task">${md}</textarea>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const textarea = overlay.querySelector('.ie-textarea');
  textarea.focus();
  textarea.setSelectionRange(0, 0);
  textarea.scrollTop = 0;

  overlay.querySelector('.ie-close-btn').addEventListener('click', closeImportExport);

  // Smart Enter: continue with - [ ] prefix on new line
  // Smart Tab / Shift+Tab: indent / un-indent current line
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const { selectionStart, selectionEnd, value } = textarea;
      // Detect indent of current line
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.slice(lineStart, selectionStart);
      const indentMatch = currentLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      const insert = '\n' + indent + '- [ ] ';
      textarea.value = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
      const pos = selectionStart + insert.length;
      textarea.setSelectionRange(pos, pos);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart, selectionEnd, value } = textarea;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      if (e.shiftKey) {
        // Un-indent: remove up to 2 leading spaces from line start
        const removed = value.slice(lineStart).match(/^( {1,2})/);
        if (removed) {
          textarea.value = value.slice(0, lineStart) + value.slice(lineStart + removed[1].length);
          const pos = Math.max(lineStart, selectionStart - removed[1].length);
          textarea.setSelectionRange(pos, pos);
        }
      } else {
        // Indent: insert 2 spaces at line start
        textarea.value = value.slice(0, lineStart) + '  ' + value.slice(lineStart);
        textarea.setSelectionRange(selectionStart + 2, selectionEnd + 2);
      }
    }
  });

  // Escape closes (but not while composing)
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeImportExport();
    }
  });

  // Click on backdrop (outside the panel) closes
  overlay.addEventListener('mousedown', e => {
    if (e.target === overlay) closeImportExport();
  });
}

export function closeImportExport() {
  if (!overlay) return;

  const textarea = overlay.querySelector('.ie-textarea');
  const text = textarea ? textarea.value : '';

  // Parse and import
  try {
    const nodes = markdownToNodes(text);
    if (nodes.length > 0) {
      importTasks(nodes);
      render();
    }
  } catch (e) {
    console.warn('Import failed:', e);
  }

  // Animate out
  overlay.classList.remove('visible');
  const el = overlay;
  overlay = null;
  setTimeout(() => el.remove(), 220);
}
