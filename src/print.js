// print.js — Print task cards (A4, 4×5 grid = 20 per page, dashed cut lines)

import { getRootTasks } from './store.js';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Collect all atomic (leaf) tasks with their ancestor path
function collectLeafTasks(nodes, ancestors = []) {
  const result = [];
  for (const node of nodes) {
    if (!node.children || node.children.length === 0) {
      result.push({ task: node, path: ancestors });
    } else {
      result.push(...collectLeafTasks(node.children, [...ancestors, node]));
    }
  }
  return result;
}

function cardHtml({ task, path }) {
  const pathHtml = path.length > 0
    ? path.map(n => `<span>${escapeHtml(n.text)}</span>`).join('<span class="sep">›</span>')
    : '';
  const doneAttr = task.done ? ' data-done' : '';
  return `<div class="card"${doneAttr}>
  <div class="card-body">
    <div class="card-text">${escapeHtml(task.text)}</div>
    ${task.done ? '<div class="card-done-badge">✓ done</div>' : ''}
  </div>
  ${pathHtml ? `<footer class="card-footer"><span class="path">${pathHtml}</span></footer>` : ''}
</div>`;
}

function buildPrintHtml(leaves) {
  const CARDS_PER_PAGE = 20;
  const pages = [];
  for (let i = 0; i < leaves.length; i += CARDS_PER_PAGE) {
    const slice = leaves.slice(i, i + CARDS_PER_PAGE);
    pages.push(`<div class="page">${slice.map(cardHtml).join('\n')}</div>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Task Cards — Columns</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');

    @page {
      size: A4 portrait;
      margin: 0;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #fff;
      color: #1a1a18;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /*
      A4: 210mm × 297mm | margins: 5mm | printable: 200mm × 287mm
      4 columns × 5 rows = 20 cards per page
      Card: 50mm wide × 57.4mm tall
    */
    .page {
      width: 210mm;
      height: 297mm;
      padding: 5mm;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(5, 1fr);
      gap: 0;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    .card {
      border: 1px dashed #c0bfba;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 3mm 3.5mm 2.5mm;
      page-break-inside: avoid;
      position: relative;
      overflow: hidden;
    }

    /* Scissor corner marks */
    .card::before,
    .card::after {
      content: '';
      position: absolute;
      width: 2mm;
      height: 2mm;
      border-color: #b0afa9;
      border-style: solid;
    }
    .card::before {
      top: 0;
      left: 0;
      border-width: 1px 0 0 1px;
    }
    .card::after {
      bottom: 0;
      right: 0;
      border-width: 0 1px 1px 0;
    }

    .card[data-done] .card-text {
      color: #888884;
      text-decoration: line-through;
      text-decoration-color: #b0afa9;
    }

    .card-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
      padding-bottom: 2mm;
      overflow: hidden;
    }

    .card-text {
      font-size: 8pt;
      font-weight: 500;
      line-height: 1.4;
      color: #1a1a18;
      letter-spacing: -0.01em;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
    }

    .card-done-badge {
      font-size: 5.5pt;
      font-family: 'DM Mono', monospace;
      color: #5aad59;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .card-footer {
      border-top: 1px solid #e8e6e0;
      padding-top: 1.5mm;
      flex-shrink: 0;
    }

    .path {
      font-family: 'DM Mono', monospace;
      font-size: 5pt;
      color: #888884;
      letter-spacing: 0.01em;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .path span {
      color: #666660;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .path .sep {
      color: #c0bfba;
      margin: 0 0.5mm;
      flex-shrink: 0;
    }

    /* Screen preview */
    @media screen {
      body { background: #e8e6e0; padding: 10mm; }
      .page {
        background: white;
        box-shadow: 0 2px 24px rgba(0,0,0,0.15);
        margin: 0 auto 10mm;
      }
    }
  </style>
</head>
<body>
${pages.join('\n')}
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
}

export function printTasks() {
  const leaves = collectLeafTasks(getRootTasks());

  if (leaves.length === 0) {
    alert('No tasks to print.');
    return;
  }

  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site to print.');
    return;
  }
  win.document.write(buildPrintHtml(leaves));
  win.document.close();
}
