// main.js — Application entry point

import { load, loadSampleData, subscribe } from './store.js';
import { initColumns, render } from './columns.js';
import { initKeyboard } from './keyboard.js';
import { initSettings, subscribeSettings, toggleSettings } from './settings.js';
import { openImportExport } from './importExport.js';

async function init() {
  const app = document.getElementById('app');

  // Build the app shell
  app.innerHTML = `
    <header class="app-header">
      <div class="app-logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="5" height="18" rx="1"/>
          <rect x="10" y="3" width="5" height="12" rx="1"/>
          <rect x="17" y="3" width="5" height="8" rx="1"/>
        </svg>
        <div class="app-logo-wordmark">
          <span class="app-logo-name">Columns</span>
          <span class="app-logo-tagline">task manager</span>
        </div>
      </div>
      <div class="header-right">
      <div class="app-shortcuts-hint">
        <div class="shortcut-group">
          <span class="shortcut-key">↑↓</span>
          <span class="shortcut-label">nav</span>
        </div>
        <div class="header-divider"></div>
        <div class="shortcut-group">
          <span class="shortcut-key">→</span>
          <span class="shortcut-label">drill</span>
        </div>
        <div class="shortcut-group">
          <span class="shortcut-key">←</span>
          <span class="shortcut-label">back</span>
        </div>
        <div class="header-divider"></div>
        <div class="shortcut-group">
          <span class="shortcut-key">Space</span>
          <span class="shortcut-label">done</span>
        </div>
        <div class="shortcut-group">
          <span class="shortcut-key">E</span>
          <span class="shortcut-label">edit</span>
        </div>
        <div class="shortcut-group">
          <span class="shortcut-key">N</span>
          <span class="shortcut-label">new</span>
        </div>
      </div>
      <div class="header-divider"></div>
      <button class="ie-btn" title="Import / Export (Ctrl+M)" id="ie-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>
      <button class="settings-btn" title="Settings" id="settings-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
      </div>
    </header>
    <main class="columns-container" id="columns-container"></main>
  `;

  const columnsContainer = document.getElementById('columns-container');
  initColumns(columnsContainer);

  // Init settings panel (injects DOM into #app)
  initSettings(app);
  document.getElementById('ie-btn').addEventListener('click', openImportExport);
  document.getElementById('settings-btn').addEventListener('click', toggleSettings);

  // Re-render when settings change (e.g. toggle count in ring)
  subscribeSettings(() => render());

  // Subscribe to state changes (register before load so render fires after data arrives)
  subscribe(() => render());

  // Load saved data from server, fall back to sample data
  const loaded = await load();
  if (!loaded) {
    loadSampleData();
  }

  // Initial render
  render();

  // Init keyboard shortcuts
  initKeyboard();
}

document.addEventListener('DOMContentLoaded', init);
