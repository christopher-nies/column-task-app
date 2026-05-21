// importExport.js — Markdown import/export + Todoist CSV import

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
  const stack = [];

  for (const line of lines) {
    const match = line.match(/^(\s*)- \[(x| )\] (.+)$/);
    if (!match) continue;

    const depth = Math.floor(match[1].length / 2);
    const done = match[2] === 'x';
    const text = match[3].trim();

    const node = makeNode(text, done);

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();
    if (stack.length === 0) root.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ node, depth });
  }

  return root;
}

// ─── Todoist CSV ──────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseTodoistCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Normalise header names: strip BOM, lowercase, alphanumeric only
  const headers = parseCSVLine(lines[0])
    .map(h => h.replace(/^﻿/, '').toLowerCase().replace(/[^a-z]/g, ''));

  const contentIdx = headers.indexOf('content');
  const indentIdx  = headers.indexOf('indent');
  const dateIdx    = headers.indexOf('date');
  const typeIdx    = headers.indexOf('type');

  if (contentIdx === -1) return []; // not a recognisable Todoist CSV

  const root  = [];
  const stack = []; // { node, indent }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols || !cols[contentIdx]?.trim()) continue;
    if (typeIdx >= 0 && cols[typeIdx]?.toLowerCase() !== 'task') continue;

    const text   = cols[contentIdx].trim();
    const indent = indentIdx >= 0 ? (parseInt(cols[indentIdx], 10) || 1) : 1;

    // Todoist dates: "2026-05-21", "2026-05-21T10:00:00", "2026-05-21T10:00:00Z"
    let date = null;
    if (dateIdx >= 0 && cols[dateIdx]) {
      const m = cols[dateIdx].match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) date = m[1];
    }

    const node = makeNode(text, false, date);

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length === 0) root.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ node, indent });
  }

  return root;
}

// ─── Shared helpers ───────────────────────────────────────

function makeNode(text, done = false, date = null) {
  return {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text,
    done,
    date,
    children: []
  };
}

// ─── Modal state ──────────────────────────────────────────

let overlay   = null;
let activeTab = 'markdown'; // 'markdown' | 'todoist'

export function isImportExportOpen() { return overlay !== null; }

export function openImportExport() {
  if (overlay) return;

  const md = nodesToMarkdown(getRootTasks());

  overlay = document.createElement('div');
  overlay.className = 'editor-overlay ie-overlay';
  overlay.innerHTML = `
    <div class="editor-panel ie-panel">
      <div class="editor-header">
        <span class="editor-title">Import / Export</span>
        <span class="editor-hint">Escape or ✕ to import &amp; close</span>
        <button class="editor-close-btn ie-close-btn" title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="ie-tabs">
        <button class="ie-tab ${activeTab === 'markdown' ? 'active' : ''}" data-tab="markdown">Markdown</button>
        <button class="ie-tab ${activeTab === 'todoist' ? 'active' : ''}" data-tab="todoist">Todoist CSV</button>
      </div>
      <textarea class="editor-textarea ie-textarea" spellcheck="false"></textarea>
    </div>
  `;

  document.body.appendChild(overlay);

  const textarea = overlay.querySelector('.ie-textarea');
  applyTab(textarea, activeTab, md);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('visible'));
  textarea.focus();
  textarea.setSelectionRange(0, 0);
  textarea.scrollTop = 0;

  overlay.querySelector('.ie-close-btn').addEventListener('click', closeImportExport);

  // Tab switching
  overlay.querySelectorAll('.ie-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === activeTab) return;
      activeTab = tab;
      overlay.querySelectorAll('.ie-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      applyTab(textarea, tab, md);
    });
  });

  // Smart Enter / Tab for markdown mode
  textarea.addEventListener('keydown', e => {
    if (activeTab !== 'markdown') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const { selectionStart, selectionEnd, value } = textarea;
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
        const removed = value.slice(lineStart).match(/^( {1,2})/);
        if (removed) {
          textarea.value = value.slice(0, lineStart) + value.slice(lineStart + removed[1].length);
          textarea.setSelectionRange(Math.max(lineStart, selectionStart - removed[1].length), Math.max(lineStart, selectionStart - removed[1].length));
        }
      } else {
        textarea.value = value.slice(0, lineStart) + '  ' + value.slice(lineStart);
        textarea.setSelectionRange(selectionStart + 2, selectionEnd + 2);
      }
    }
  });

  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeImportExport(); }
  });
  overlay.addEventListener('mousedown', e => {
    if (e.target === overlay) closeImportExport();
  });
}

function applyTab(textarea, tab, markdownContent) {
  if (tab === 'markdown') {
    textarea.value = markdownContent;
    textarea.placeholder = '- [ ] Task\n  - [ ] Child task\n  - [x] Done child\n- [x] Done task';
  } else {
    textarea.value = '';
    textarea.placeholder = 'Paste Todoist CSV export here…\n\nExport from Todoist: Settings → Backups → Export as CSV';
  }
  textarea.focus();
  textarea.setSelectionRange(0, 0);
  textarea.scrollTop = 0;
}

export function closeImportExport() {
  if (!overlay) return;

  const textarea = overlay.querySelector('.ie-textarea');
  const text = textarea ? textarea.value.trim() : '';

  try {
    const nodes = activeTab === 'todoist'
      ? parseTodoistCSV(text)
      : markdownToNodes(text);
    if (nodes.length > 0) {
      importTasks(nodes);
      render();
    }
  } catch (e) {
    console.warn('Import failed:', e);
  }

  overlay.classList.remove('visible');
  const el = overlay;
  overlay = null;
  setTimeout(() => el.remove(), 220);
}
