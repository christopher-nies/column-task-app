// settings.js — App settings with localStorage persistence

const STORAGE_KEY = 'columns-settings';

const DEFAULTS = {
  showCountInRing: false,
  theme: 'dark',
};

// ─── State ────────────────────────────────────────────────

let settings = { ...DEFAULTS };
let settingsListeners = [];
let autoMql = null;   // stored matchMedia listener for 'auto' theme
let panelEl = null;
let backdropEl = null;
let _isOpen = false;

// ─── Load from localStorage ───────────────────────────────

(function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      settings = { ...DEFAULTS, ...parsed };
    }
  } catch (e) {
    // ignore parse errors, use defaults
  }
  applyTheme();
})();

// ─── Theme ───────────────────────────────────────────

function applyTheme() {
  // Clean up previous auto listener
  if (autoMql) {
    autoMql.mql.removeEventListener('change', autoMql.handler);
    autoMql = null;
  }

  const theme = settings.theme || 'dark';

  if (theme === 'auto') {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      document.documentElement.dataset.theme = e.matches ? 'light' : 'dark';
    };
    // Apply immediately
    document.documentElement.dataset.theme = mql.matches ? 'light' : 'dark';
    mql.addEventListener('change', handler);
    autoMql = { mql, handler };
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

// ─── Public API ───────────────────────────────────────────

export function getSettings() {
  return { ...settings };
}

export function setSetting(key, value) {
  settings[key] = value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // ignore storage errors
  }
  if (key === 'theme') applyTheme();
  settingsListeners.forEach(fn => fn(settings));
}

export function subscribeSettings(fn) {
  settingsListeners.push(fn);
  return () => { settingsListeners = settingsListeners.filter(l => l !== fn); };
}

export function isSettingsOpen() {
  return _isOpen;
}

// ─── Panel DOM ────────────────────────────────────────────

export function initSettings(appEl) {
  // Backdrop — invisible click-catcher
  backdropEl = document.createElement('div');
  backdropEl.className = 'settings-backdrop';
  backdropEl.addEventListener('click', closeSettings);

  // Panel
  panelEl = document.createElement('div');
  panelEl.className = 'settings-panel';
  panelEl.setAttribute('role', 'dialog');
  panelEl.setAttribute('aria-label', 'Settings');

  panelEl.innerHTML = `
    <div class="settings-header">
      <span class="settings-title">Settings</span>
      <button class="settings-close-btn" title="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="settings-body">
      <div class="settings-section">
        <div class="settings-section-label">Progress Ring</div>
        <label class="settings-row" for="toggle-count-in-ring">
          <div class="settings-row-text">
            <span class="settings-row-label">Show undone count</span>
            <span class="settings-row-desc">Display remaining tasks inside the ring</span>
          </div>
          <div class="settings-toggle ${settings.showCountInRing ? 'on' : ''}" id="toggle-count-in-ring" role="switch" aria-checked="${settings.showCountInRing}" tabindex="0">
            <div class="settings-toggle-thumb"></div>
          </div>
        </label>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-section">
        <div class="settings-section-label">Appearance</div>
        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-label">Theme</span>
            <span class="settings-row-desc">Choose light, dark, or match your system</span>
          </div>
          <div class="theme-picker" id="theme-picker">
            <button class="theme-btn ${settings.theme === 'light' ? 'active' : ''}" data-theme="light">Light</button>
            <button class="theme-btn ${settings.theme === 'dark' ? 'active' : ''}" data-theme="dark">Dark</button>
            <button class="theme-btn ${settings.theme === 'auto' ? 'active' : ''}" data-theme="auto">Auto</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Close button
  panelEl.querySelector('.settings-close-btn').addEventListener('click', closeSettings);

  // Toggle interaction
  const toggle = panelEl.querySelector('#toggle-count-in-ring');
  function activateToggle() {
    const next = !settings.showCountInRing;
    setSetting('showCountInRing', next);
    toggle.classList.toggle('on', next);
    toggle.setAttribute('aria-checked', String(next));
  }
  toggle.addEventListener('click', activateToggle);
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateToggle(); }
  });

  // Theme picker interaction
  const themePicker = panelEl.querySelector('#theme-picker');
  themePicker.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme]');
    if (!btn) return;
    const theme = btn.dataset.theme;
    setSetting('theme', theme);
    themePicker.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  });

  appEl.appendChild(backdropEl);
  appEl.appendChild(panelEl);
}

export function openSettings() {
  if (!panelEl) return;
  _isOpen = true;
  backdropEl.classList.add('visible');
  panelEl.classList.add('visible');
}

export function closeSettings() {
  if (!panelEl) return;
  _isOpen = false;
  backdropEl.classList.remove('visible');
  panelEl.classList.remove('visible');
}

export function toggleSettings() {
  _isOpen ? closeSettings() : openSettings();
}
