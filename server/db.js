// server/db.js — SQLite database layer via better-sqlite3

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Data directory: prefer DATA_DIR env var (set in Docker), else local ./data/
const dataDir = process.env.DATA_DIR || join(__dirname, '../data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'tasks.db');
const db = new Database(dbPath);

// ─── Schema ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ─── API ───────────────────────────────────────────────────────────────────

/**
 * Load the full app state (root task tree + selectedPath).
 * Returns null if no state has been saved yet.
 */
export function loadState() {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('state');
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

/**
 * Persist the full app state.
 * @param {{ root: Task[], selectedPath: string[] }} state
 */
export function saveState(state) {
  db.prepare(`
    INSERT INTO app_state (key, value)
    VALUES ('state', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(JSON.stringify(state));
}
