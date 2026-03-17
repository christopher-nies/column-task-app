# Column Task App — Build Plan

## Research
- [x] Investigate colonnes.com
- [x] Read the blog article on receipt printer productivity
- [x] Read the "Why it works" page
- [x] Examine the uploaded screenshot
- [x] Check the workspace for existing code

## Planning
- [x] Write implementation plan
- [x] Get user approval on the plan

## Execution
- [x] Set up project (Vite + vanilla JS)
- [x] Build the data model (tree of tasks) — src/store.js
- [x] Build the column-based UI — src/columns.js
- [x] Implement selection mode (navigate, select tasks)
- [x] Implement edit mode (fast text editing of tasks) — src/editor.js
- [x] Implement task completion & progress indicators
- [x] Add keyboard navigation — src/keyboard.js
- [x] Add persistence (localStorage) — store.js save()/load()
- [x] Polish UI (animations, dark mode, responsive) — style.css, src/animations.js

## Verification
- [ ] Manual browser testing of core flows
- [ ] Verify data persistence across reloads

## Phase 2 — Backend
- [ ] Add Express + SQLite backend (server/)
- [ ] Swap store.js persistence from localStorage to REST API
- [ ] Add Dockerfile + docker-compose.yml for self-hosting
