// print.js — Print task cards (A4, 4×5 grid = 20 per page)

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

function cardHtml({ task, path }, index) {
  const num = String(index + 1).padStart(2, '0');
  const pathHtml = path.length > 0
    ? path.map(n => `<span>${escapeHtml(n.text)}</span>`).join('<span class="sep">›</span>')
    : '';
  return `<div class="card">
  <div class="card-top">
    <div class="card-num">${num}</div>
  </div>
  <div class="card-body">
    <div class="card-text">${escapeHtml(task.text)}</div>
  </div>
  <footer class="card-footer">
    <div class="check-box"></div>
    ${pathHtml ? `<div class="path">${pathHtml}</div>` : ''}
  </footer>
</div>`;
}

function buildPrintHtml(leaves) {
  const CARDS_PER_PAGE = 20;
  const pages = [];
  for (let i = 0; i < leaves.length; i += CARDS_PER_PAGE) {
    const slice = leaves.slice(i, i + CARDS_PER_PAGE);
    pages.push(`<div class="page">${slice.map((l, j) => cardHtml(l, i + j)).join('\n')}</div>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Task Cards — Columns</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #fff;
      color: #1c1b18;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /*
      A4: 210mm × 297mm | padding: 4mm | printable: 202mm × 289mm
      4 cols × 5 rows = 20 cards — each card ~50.5mm × 57.8mm
    */
    .page {
      width: 210mm;
      height: 297mm;
      padding: 4mm;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(5, 1fr);
      gap: 0;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* ── Card shell ─────────────────────────────────── */
    .card {
      border: 0.3pt solid #d0cbc0;
      border-top: 2pt solid #1c1b18;
      background: #fffef9;
      display: flex;
      flex-direction: column;
      padding: 2.5mm 3mm 2.5mm;
      page-break-inside: avoid;
      position: relative;
      overflow: hidden;
    }

    /* ── Card top row (number) ──────────────────────── */
    .card-top {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 2mm;
      flex-shrink: 0;
    }

    .card-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 5pt;
      color: #1c1b18;
      letter-spacing: 0.04em;
      line-height: 1;
    }

    /* ── Task text (hero) ───────────────────────────── */
    .card-body {
      flex: 1;
      display: flex;
      align-items: flex-start;
      overflow: hidden;
    }

    .card-text {
      font-family: 'Lora', Georgia, serif;
      font-size: 8pt;
      font-weight: 500;
      line-height: 1.45;
      color: #1c1b18;
      letter-spacing: -0.005em;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
    }

    /* ── Footer: checkbox + path ────────────────────── */
    .card-footer {
      display: flex;
      align-items: center;
      gap: 2mm;
      margin-top: 2mm;
      padding-top: 1.5mm;
      border-top: 0.4pt solid #d8d2c8;
      flex-shrink: 0;
      min-height: 5.5mm;
    }

    .check-box {
      width: 3mm;
      height: 3mm;
      border: 0.4pt solid #1c1b18;
      border-radius: 0.5pt;
      flex-shrink: 0;
    }

    .path {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6pt;
      color: #1c1b18;
      letter-spacing: 0.01em;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      overflow: hidden;
      white-space: nowrap;
      min-width: 0;
    }

    .path span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex-shrink: 1;
    }

    .path span:last-of-type {
      flex-shrink: 0;
    }

    .path .sep {
      color: #1c1b18;
      margin: 0 0.8mm;
      flex-shrink: 0;
    }

    /* ── Screen preview ─────────────────────────────── */
    @media screen {
      body {
        background: #eae5dc;
        padding: 12mm;
      }
      .page {
        background: #f8f5ef;
        box-shadow:
          0 1px 3px rgba(0,0,0,0.08),
          0 6px 24px rgba(0,0,0,0.10);
        margin: 0 auto 14mm;
      }
      .card {
        transition: box-shadow 0.15s ease;
      }
      .card:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.10);
        z-index: 1;
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
  const leaves = collectLeafTasks(getRootTasks()).filter(({ task }) => !task.done);

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
