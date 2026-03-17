// server/index.js — Express API server

import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadState, saveState } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// ─── Static files (production build) ───────────────────────────────────────
// In development, Vite handles this. In production (Docker), Express serves
// the pre-built dist/ folder.
const distDir = join(__dirname, '../dist');
app.use(express.static(distDir));

// ─── API routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/state
 * Returns the saved task tree and selectedPath.
 * 200 + { root, selectedPath } if data exists.
 * 204 No Content if no state has been saved yet.
 */
app.get('/api/state', (req, res) => {
  const state = loadState();
  if (!state) return res.sendStatus(204);
  res.json(state);
});

/**
 * PUT /api/state
 * Saves the full app state. Body: { root, selectedPath }
 * Returns 200 + { ok: true }
 */
app.put('/api/state', (req, res) => {
  const { root, selectedPath } = req.body;
  if (!Array.isArray(root) || !Array.isArray(selectedPath)) {
    return res.status(400).json({ error: 'Invalid state shape' });
  }
  saveState({ root, selectedPath });
  res.json({ ok: true });
});

// ─── Catch-all: serve index.html for client-side routing ────────────────────
// Express 5 requires named wildcard params — '*' alone is invalid
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(distDir, 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Column Task App running on http://localhost:${PORT}`);
});
