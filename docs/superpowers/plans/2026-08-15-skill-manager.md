# Skill Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Vue 3 + Node app that lists, searches, and toggles coding-agent skills (`SKILL.md` ↔ `SKILL.md.disabled`) across `~/.agents/skills` and `~/.pi/agent/skills`, with presets and light/dark themes.

**Architecture:** Express server (127.0.0.1:4217) recursively scans both skill roots, dedupes by realpath, serves the built Vue 3 SPA plus a small JSON API (skills, toggle, presets). Toggling renames `SKILL.md` in place. Presets are JSON files in `presets/`.

**Tech Stack:** Vue 3, Vite, Express, node:test, marked

**Spec:** `docs/superpowers/specs/2026-08-15-skill-manager-design.md`

## Global Constraints

- Node ESM (`"type": "module"`); no TypeScript
- Server binds `127.0.0.1:4217` only; no auth
- Only renames `SKILL.md` / `SKILL.md.disabled` inside scanned dirs; no deletes, no writes outside managed roots
- Presets stored as JSON files in `presets/` (one per preset, filename = slug of name)
- `run.sh` is the only entry point; port 4217
- Tests use temp fixtures (`fs.mkdtemp`) — never touch real `~/.agents/skills`
- Roots overridable via env: `SKILL_AGENTS_ROOT`, `SKILL_PI_ROOT`, `SKILL_PRESET_DIR` (used by tests)

---

### Task 1: Scaffolding + run.sh

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/App.vue`, `src/style.css`, `server/index.js`, `run.sh`

**Interfaces:**
- Consumes: nothing
- Produces: `run.sh` boots the app at `http://127.0.0.1:4217` serving the built SPA; `npm test` runs `node --test test/`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "skill-manager",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "start": "node server/index.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "express": "^4.19.2",
    "marked": "^12.0.2",
    "vue": "^3.4.27"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: { outDir: 'dist' }
})
```

- [ ] **Step 3: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Skill Manager</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `src/main.js`, `src/App.vue`, `src/style.css`**

`src/main.js`:
```js
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')
```

`src/App.vue` (stub — replaced in Task 8):
```vue
<template>
  <header><h1>Skill Manager</h1></header>
  <main><p>Booting…</p></main>
</template>
```

`src/style.css` (stub — full styles in Task 8):
```css
body { margin: 0; font-family: system-ui, sans-serif; }
```

- [ ] **Step 5: Create `server/index.js`** (static-only; API added in Task 5)

```js
import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.static(join(__dirname, '..', 'dist')))
app.listen(4217, '127.0.0.1', () => console.log('skill-manager on http://127.0.0.1:4217'))
```

- [ ] **Step 6: Create `run.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "→ npm install"
  npm install
fi

echo "→ vite build"
npm run build

echo "→ starting on http://127.0.0.1:4217"
node server/index.js &
SERVER_PID=$!

sleep 1
open "http://127.0.0.1:4217" 2>/dev/null || xdg-open "http://127.0.0.1:4217" 2>/dev/null || true

wait $SERVER_PID
```

- [ ] **Step 7: Verify boot**

Run: `chmod +x run.sh && npm install && npm run build && node server/index.js &` then `curl -s http://127.0.0.1:4217/ | grep -o "Skill Manager"`
Expected: prints `Skill Manager`. Then `kill %1`.

- [ ] **Step 8: Commit**

```bash
git add package.json vite.config.js index.html src server run.sh
git commit -m "feat: scaffolding — vite+vue+express, run.sh entry"
```

---

## Implementation Notes (appendix — read this before writing Tasks 2–11)

**Server structure:**
- `server/roots.js`: `getRoots()` → `{ agentsRoot, piRoot, presetDir }` from env `SKILL_AGENTS_ROOT` / `SKILL_PI_ROOT` / `SKILL_PRESET_DIR`, defaults `~/.agents/skills`, `~/.pi/agent/skills`, `<app>/presets` (resolve via `homedir()`)
- `server/app.js`: `createApp()` factory (express, json, all routes, static dist) — importable by tests; `server/index.js` = `createApp().listen(4217, '127.0.0.1', ...)`
- Testable signatures: `scanSkills(roots = getRoots())`, `parseFrontmatter(text)`, `toggleSkill(id, roots = getRoots())`, `assertManagedDir(id, roots)`; presets fns take options bag as LAST param: `{ presetDir, skills, toggle }` with defaults

**API (all JSON):**
- `GET /api/skills` → `{ skills: [...] }`
- `POST /api/skills/toggle` `{ id }` → `{ id, enabled }` (400 traversal, 409 no SKILL.md)
- `GET /api/skills/content?id=` → `{ content }` (SKILL.md or .disabled; 400/404) — spec gap, needed by drawer
- `GET /api/presets` → `{ presets: [{ name, builtin, skills, count }] }` (All, None first)
- `POST /api/presets` `{ name, skills }` · `PATCH /api/presets/:name` `{ name }` · `DELETE /api/presets/:name` (409 built-ins, 404 missing)
- `POST /api/presets/apply` `{ preset }` → `{ enabled: [...] }`

**categories.js:** `RULES = [[category, [regexFragments]], ...]`; match = `new RegExp(frag, 'i').test(lowercased name+description)`; first hit wins, else `'General'`. Critical fragments: `\bart\b` ("artifacts" ≠ Design), `\bplans?\b` ("plannotator" ≠ Planning), `\bmcp\b`, `\bagents?\b` ("subagent" ≠ agent), `\bpdf\b`; stems: `\bdiagnos`, `\borchestrat`, `\bspec`, `\bdesign`, `\bsearch`. Order per spec table.

**Frontend contracts:**
- `App.vue`: state `skills, presets, search, category, status, selected, dialogPreset, toast, theme`; `refresh()` fetches `/api/skills` + `/api/presets`; `toggle(skill)` optimistic flip → POST → refetch, error → revert + toast; `filtered` = search(q on name+desc) → category → status, sorted category→name; theme → `document.documentElement.dataset.theme` + `localStorage('theme')`, default `matchMedia('(prefers-color-scheme: dark)')`
- `Toolbar.vue`: props `{ categories }`, `defineModel('search'|'category'|'status')`
- `SkillRow.vue`: props `{ skill }`, emits `toggle` / `select`; checkbox `@click.stop @change`; row `@click` → select
- `DetailDrawer.vue`: props `{ skill }` (null = closed), emits `close`; fetch `/api/skills/content?id=`; `marked.parse`; `v-html`
- `PresetMenu.vue`: props `{ presets }`, emits `apply` / `save` / `rename` / `delete`
- `ConfirmDialog.vue`: props `{ title, skills (names[]), disabledCount }`, emits `confirm` / `cancel`
- `style.css`: CSS vars under `:root,[data-theme="dark"]` and `[data-theme="light"]`; `--accent` green (checkbox accent-color); drawer = fixed right 480px panel; dialog = centered overlay

**Task outline (append after Task 1, each = failing test → impl → pass → commit):**
- T2 `shared/categories.js` + `test/categories.test.js`
- T3 `server/lib/scan.js` + `test/scan.test.js` (fixture: flat, nested group, pi symlinked group, standalone real dir, disabled, empty-dir excluded; dedupe by realpath)
- T4 `server/lib/toggle.js` + `test/toggle.test.js` (round-trip, 409, 400 traversal)
- T5 `server/roots.js` + `server/app.js` (skills+content routes) + `test/api.test.js` (fixture env roots, listen(0), fetch)
- T6 `server/lib/presets.js` + `test/presets.test.js` (CRUD, apply plan semantics, built-ins)
- T7 presets routes in `app.js` + API tests
- T8 core UI: `App.vue`, `Toolbar.vue`, `SkillRow.vue`, full `style.css` (dark default) — manual verify
- T9 `DetailDrawer.vue` + `marked` + light theme + header theme toggle — manual verify
- T10 `PresetMenu.vue` + `ConfirmDialog.vue` + save/rename/delete wiring — manual verify
- T11 E2E manual (toggle real skill → on-disk rename → agent no longer lists it; apply preset) + `README.md` + final commit
