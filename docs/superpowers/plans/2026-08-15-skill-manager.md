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

- [x] **Step 1: Create `package.json`**

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

- [x] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: { outDir: 'dist' }
})
```

- [x] **Step 3: Create `index.html`**

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

- [x] **Step 4: Create `src/main.js`, `src/App.vue`, `src/style.css`**

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

- [x] **Step 5: Create `server/index.js`** (static-only; API added in Task 5)

```js
import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.static(join(__dirname, '..', 'dist')))
app.listen(4217, '127.0.0.1', () => console.log('skill-manager on http://127.0.0.1:4217'))
```

- [x] **Step 6: Create `run.sh`**

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

- [x] **Step 7: Verify boot**

Run: `chmod +x run.sh && npm install && npm run build && node server/index.js &` then `curl -s http://127.0.0.1:4217/ | grep -o "Skill Manager"`
Expected: prints `Skill Manager`. Then `kill %1`.

- [x] **Step 8: Commit**

```bash
git add package.json vite.config.js index.html src server run.sh
git commit -m "feat: scaffolding — vite+vue+express, run.sh entry"
```

### Task 2: Category Heuristics

**Files:**
- Create: `shared/categories.js`
- Test: `test/categories.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `categorize(name, description) → string` (category name, or `'General'`)

- [x] **Step 1: Write the failing test**

```js
// test/categories.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categorize } from '../shared/categories.js'

test('pdf → Documents', () =>
  assert.equal(categorize('pdf', 'Use for PDF files'), 'Documents'))
test('brainstorming → Planning', () =>
  assert.equal(categorize('brainstorming', 'Turn ideas into specs'), 'Planning'))
test('plan stem does not match plannotator', () =>
  assert.notEqual(categorize('plannotator-annotate', 'Open Plannotator UI for markdown'), 'Planning'))
test('art word boundary: artifacts → Research & Web', () =>
  assert.equal(categorize('web-artifacts-builder', 'Suite of tools for creating HTML artifacts'), 'Research & Web'))
test('diagnosing → Debugging', () =>
  assert.equal(categorize('diagnosing-bugs', 'Diagnosis loop for hard bugs'), 'Debugging'))
test('mcp → MCP', () =>
  assert.equal(categorize('mcp-builder', 'Guide for creating MCP servers'), 'MCP'))
test('git → Git', () =>
  assert.equal(categorize('using-git-worktrees', 'Isolated workspace via git worktree'), 'Git'))
test('unknown → General', () =>
  assert.equal(categorize('foo', 'bar baz'), 'General'))
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- test/categories.test.js`
Expected: FAIL — "Cannot find module '../shared/categories.js'"

- [x] **Step 3: Implement `shared/categories.js`**

```js
// Heuristic category rules. First match wins, else 'General'.
// Fragments are case-insensitive regex; word boundaries keep "artifacts" ≠
// Design and "plannotator" ≠ Planning. Order matters (see spec table).
const RULES = [
  ['Skill Authoring', ['\\bskill', 'skill\\.md', 'agents\\.md']],
  ['Documents', ['\\bpdf\\b', '\\bdocx\\b', '\\bpptx\\b', '\\bxlsx\\b', '\\bspreadsheet', '\\bword\\b']],
  ['Git', ['\\bgit\\b', '\\bbranch', '\\bmerge', '\\brebase', '\\bcommit', '\\bcherry']],
  ['Debugging', ['\\bdebug', '\\bdiagnos', '\\bregression']],
  ['Testing', ['\\btest', '\\btdd\\b', 'red-green']],
  ['Planning', ['\\bbrainstorm', '\\bspec', '\\bplans?\\b', '\\bproposal']],
  ['Design & Visual', ['\\bdesign', '\\blogo', '\\bart\\b', '\\btheme', '\\bcanvas', '\\bposter', '\\bgif\\b']],
  ['Research & Web', ['\\bsearch', '\\bweb', '\\bscrape', '\\bcrawl', '\\bfetch', '\\bresearch', '\\btranscript']],
  ['MCP', ['\\bmcp\\b']],
  ['Agents', ['\\bagents?\\b', '\\bsubagent', '\\borchestrat', '\\bdispatch']],
  ['Ops & Setup', ['\\bserver', '\\bvps\\b', '\\bops\\b', '\\bsetup', '\\bprovision', '\\bssh\\b', '\\bdeploy']],
  ['Prompting', ['\\bprompt', '\\bgoal', '\\bloop', '\\binstruction']]
]

export function categorize(name, description) {
  const text = `${name} ${description}`.toLowerCase()
  for (const [category, fragments] of RULES) {
    if (fragments.some(f => new RegExp(f, 'i').test(text))) return category
  }
  return 'General'
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all 8 tests)

- [x] **Step 5: Commit**

```bash
git add shared/categories.js test/categories.test.js
git commit -m "feat: category heuristics with word-boundary regex rules"
```

### Task 3: Skill Scan

**Files:**
- Create: `server/roots.js`, `server/lib/scan.js`
- Test: `test/scan.test.js`

**Interfaces:**
- Consumes: `categorize(name, description)` (Task 2)
- Produces: `getRoots() → { agentsRoot, piRoot, presetDir }`; `scanSkills(roots = getRoots()) → Skill[]`; `parseFrontmatter(text) → object`. Skill = `{ id, name, description, enabled, category, source }`

- [ ] **Step 1: Create `server/roots.js`**

```js
import { resolve, join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const APP_ROOT = dirname(fileURLToPath(import.meta.url))

export function getRoots() {
  return {
    agentsRoot: resolve(process.env.SKILL_AGENTS_ROOT || join(homedir(), '.agents', 'skills')),
    piRoot: resolve(process.env.SKILL_PI_ROOT || join(homedir(), '.pi', 'agent', 'skills')),
    presetDir: resolve(process.env.SKILL_PRESET_DIR || join(APP_ROOT, '..', 'presets'))
  }
}
```

- [ ] **Step 2: Write the failing test**

```js
// test/scan.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanSkills, parseFrontmatter } from '../server/lib/scan.js'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'sm-scan-'))
  const agents = join(root, 'agents')
  const pi = join(root, 'pi')
  const mk = (dir, file, content) => {
    mkdirSync(join(agents, dir), { recursive: true })
    writeFileSync(join(agents, dir, file), content)
  }
  mk('alpha', 'SKILL.md', '---\nname: alpha\ndescription: A test skill\n---\n# Alpha')
  mk('grp/beta', 'SKILL.md', '---\nname: beta\ndescription: "Nested skill"\n---\n# Beta')
  mk('gamma', 'SKILL.md.disabled', '---\nname: gamma\ndescription: off\n---\n# Gamma')
  mkdirSync(join(agents, 'empty'), { recursive: true })
  writeFileSync(join(agents, 'empty/README.md'), 'no skill here')
  mkdirSync(join(pi, 'solo'), { recursive: true })
  writeFileSync(join(pi, 'solo/SKILL.md'), '---\nname: solo\ndescription: standalone\n---\n# Solo')
  symlinkSync(join(agents, 'grp'), join(pi, 'grp')) // pi-style group symlink
  return { root, agents, pi }
}

test('scan finds flat + nested, dedupes symlinks, excludes empty dirs', () => {
  const { root, agents, pi } = fixture()
  try {
    const skills = scanSkills({ agentsRoot: agents, piRoot: pi })
    const names = skills.map(s => s.name).sort()
    assert.deepEqual(names, ['alpha', 'beta', 'gamma', 'solo'])
    assert.equal(skills.find(s => s.name === 'gamma').enabled, false)
    assert.equal(skills.find(s => s.name === 'solo').source, 'pi')
    assert.equal(skills.find(s => s.name === 'beta').source, 'agents')
    assert.equal(skills.find(s => s.name === 'beta').description, 'Nested skill') // quoted fm
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('parseFrontmatter tolerates missing block', () => {
  assert.deepEqual(parseFrontmatter('# no frontmatter'), {})
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- test/scan.test.js`
Expected: FAIL — "Cannot find module '../server/lib/scan.js'"

- [ ] **Step 4: Implement `server/lib/scan.js`**

```js
import { readdirSync, statSync, existsSync, realpathSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { categorize } from '../../shared/categories.js'
import { getRoots } from '../roots.js'

function safeRead(p) {
  try { return readFileSync(p, 'utf8') } catch { return null }
}

export function parseFrontmatter(text) {
  const m = (text || '').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return {}
  const out = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '')
  }
  return out
}

function walk(dir, found, depth) {
  if (depth > 6) return
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue
    const full = join(dir, e.name)
    let st
    try { st = statSync(full) } catch { continue } // broken symlink
    if (!st.isDirectory()) continue
    if (existsSync(join(full, 'SKILL.md')) || existsSync(join(full, 'SKILL.md.disabled'))) {
      found.push(full) // skill dir — never descend into it
    } else {
      walk(full, found, depth + 1) // group dir — keep descending
    }
  }
}

export function scanSkills(roots = getRoots()) {
  const found = []
  for (const root of [roots.agentsRoot, roots.piRoot]) {
    if (existsSync(root)) walk(root, found, 0)
  }
  const seen = new Set()
  const skills = []
  for (const dir of found) {
    let real
    try { real = realpathSync(dir) } catch { continue }
    if (seen.has(real)) continue
    seen.add(real)
    const fm = parseFrontmatter(safeRead(join(real, 'SKILL.md')) || safeRead(join(real, 'SKILL.md.disabled')) || '')
    const name = fm.name || basename(real)
    skills.push({
      id: real,
      name,
      description: fm.description || '',
      enabled: existsSync(join(real, 'SKILL.md')),
      category: categorize(name, fm.description || ''),
      source: real.startsWith(roots.agentsRoot + '/') ? 'agents' : 'pi'
    })
  }
  return skills
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all)

- [ ] **Step 6: Commit**

```bash
git add server/roots.js server/lib/scan.js test/scan.test.js
git commit -m "feat: recursive skill scan with realpath dedupe + frontmatter parse"
```

### Task 4: Toggle

**Files:**
- Create: `server/lib/toggle.js`
- Test: `test/toggle.test.js`

**Interfaces:**
- Consumes: `getRoots()` (Task 3)
- Produces: `toggleSkill(id, roots = getRoots()) → { id, enabled }` (throws `Error` with `.status` 400/409); `assertManagedDir(id, roots) → realPath`

- [ ] **Step 1: Write the failing test**

```js
// test/toggle.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { toggleSkill } from '../server/lib/toggle.js'

test('toggle round-trip renames SKILL.md ↔ SKILL.md.disabled', () => {
  const root = mkdtempSync(join(tmpdir(), 'sm-toggle-'))
  const dir = join(root, 'sk')
  mkdirSync(dir)
  writeFileSync(join(dir, 'SKILL.md'), '---\nname: sk\n---\n')
  const roots = { agentsRoot: root, piRoot: root }
  try {
    let r = toggleSkill(dir, roots)
    assert.equal(r.enabled, false)
    assert.ok(existsSync(join(dir, 'SKILL.md.disabled')))
    r = toggleSkill(dir, roots)
    assert.equal(r.enabled, true)
    assert.ok(existsSync(join(dir, 'SKILL.md')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('dir with neither file → 409', () => {
  const root = mkdtempSync(join(tmpdir(), 'sm-toggle-'))
  const empty = join(root, 'empty')
  mkdirSync(empty)
  try {
    assert.throws(() => toggleSkill(empty, { agentsRoot: root, piRoot: root }),
      e => e.status === 409)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('path outside managed roots → 400', () => {
  assert.throws(() => toggleSkill('/etc', { agentsRoot: '/tmp/a', piRoot: '/tmp/b' }),
    e => e.status === 400)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/toggle.test.js`
Expected: FAIL — "Cannot find module '../server/lib/toggle.js'"

- [ ] **Step 3: Implement `server/lib/toggle.js`**

```js
import { existsSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getRoots } from '../roots.js'

function httpError(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

export function assertManagedDir(id, roots = getRoots()) {
  const real = resolve(String(id))
  const ok = [roots.agentsRoot, roots.piRoot].some(r => real === r || real.startsWith(r + '/'))
  if (!ok) throw httpError(400, 'id is not a managed skill dir')
  return real
}

export function toggleSkill(id, roots = getRoots()) {
  const dir = assertManagedDir(id, roots)
  const on = join(dir, 'SKILL.md')
  const off = join(dir, 'SKILL.md.disabled')
  if (existsSync(on)) {
    renameSync(on, off)
    return { id, enabled: false }
  }
  if (existsSync(off)) {
    renameSync(off, on)
    return { id, enabled: true }
  }
  throw httpError(409, 'no SKILL.md or SKILL.md.disabled in dir')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/lib/toggle.js test/toggle.test.js
git commit -m "feat: toggle — SKILL.md rename with root validation"
```

### Task 5: Express App + Skills API

**Files:**
- Create: `server/app.js`, `test/api.test.js`
- Modify: `server/index.js` (thin bootstrap over `createApp`)

**Interfaces:**
- Consumes: `scanSkills(roots)`, `toggleSkill(id, roots)`, `assertManagedDir`, `getRoots()`
- Produces: `createApp() → express app` with `GET /api/skills`, `POST /api/skills/toggle`, `GET /api/skills/content`; serves `dist/`

- [ ] **Step 1: Write the failing test**

```js
// test/api.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let server, base, root

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'sm-api-'))
  const agents = join(root, 'agents')
  mkdirSync(join(agents, 'alpha'), { recursive: true })
  writeFileSync(join(agents, 'alpha/SKILL.md'), '---\nname: alpha\ndescription: demo\n---\n# Alpha\nBody here')
  process.env.SKILL_AGENTS_ROOT = agents
  process.env.SKILL_PI_ROOT = join(root, 'pi') // non-existent is fine
  const { createApp } = await import('../server/app.js')
  server = createApp().listen(0)
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
  rmSync(root, { recursive: true, force: true })
  delete process.env.SKILL_AGENTS_ROOT
  delete process.env.SKILL_PI_ROOT
})

test('GET /api/skills returns scanned skills', async () => {
  const r = await fetch(`${base}/api/skills`)
  const data = await r.json()
  assert.equal(r.status, 200)
  assert.equal(data.skills.length, 1)
  assert.equal(data.skills[0].name, 'alpha')
  assert.equal(data.skills[0].enabled, true)
})

test('POST /api/skills/toggle disables then re-enables', async () => {
  const { skills } = await (await fetch(`${base}/api/skills`)).json()
  const id = skills[0].id
  let r = await fetch(`${base}/api/skills/toggle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })
  assert.deepEqual(await r.json(), { id, enabled: false })
  r = await fetch(`${base}/api/skills/toggle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })
  assert.deepEqual(await r.json(), { id, enabled: true })
})

test('POST toggle rejects traversal → 400', async () => {
  const r = await fetch(`${base}/api/skills/toggle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '/etc' })
  })
  assert.equal(r.status, 400)
})

test('GET /api/skills/content returns SKILL.md body', async () => {
  const { skills } = await (await fetch(`${base}/api/skills`)).json()
  const r = await fetch(`${base}/api/skills/content?id=${encodeURIComponent(skills[0].id)}`)
  const data = await r.json()
  assert.equal(r.status, 200)
  assert.match(data.content, /# Alpha/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/api.test.js`
Expected: FAIL — "Cannot find module '../server/app.js'"

- [ ] **Step 3: Implement `server/app.js`**

```js
import express from 'express'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { scanSkills } from './lib/scan.js'
import { toggleSkill, assertManagedDir } from './lib/toggle.js'

const APP_ROOT = dirname(fileURLToPath(import.meta.url))

function safeRead(p) {
  try { return readFileSync(p, 'utf8') } catch { return null }
}

export function createApp() {
  const app = express()
  app.use(express.json())

  app.get('/api/skills', (req, res) => {
    res.json({ skills: scanSkills() })
  })

  app.post('/api/skills/toggle', (req, res) => {
    try {
      res.json(toggleSkill(req.body?.id))
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.get('/api/skills/content', (req, res) => {
    try {
      const dir = assertManagedDir(String(req.query.id || ''))
      const content = safeRead(join(dir, 'SKILL.md')) ?? safeRead(join(dir, 'SKILL.md.disabled'))
      if (content == null) return res.status(404).json({ error: 'not found' })
      res.json({ content })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.use(express.static(join(APP_ROOT, '..', 'dist')))
  return app
}
```

- [ ] **Step 4: Replace `server/index.js`**

```js
import { createApp } from './app.js'

createApp().listen(4217, '127.0.0.1', () => console.log('skill-manager on http://127.0.0.1:4217'))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all)

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/index.js test/api.test.js
git commit -m "feat: express app with skills API (list, toggle, content)"
```

### Task 6: Presets Library

**Files:**
- Create: `server/lib/presets.js`
- Test: `test/presets.test.js`

**Interfaces:**
- Consumes: `scanSkills`, `toggleSkill`, `getRoots()` (as defaults)
- Produces: `listPresets(opts)`, `createPreset(name, skills, opts)`, `renamePreset(oldName, newName, opts)`, `deletePreset(name, opts)`, `applyPreset(name, opts)`, `slug(name)`. `opts = { presetDir, skills, toggle }` — all optional. Preset shape: `{ name, builtin, skills, count }`

- [ ] **Step 1: Write the failing test**

```js
// test/presets.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listPresets, createPreset, renamePreset, deletePreset, applyPreset } from '../server/lib/presets.js'

function presetDir() {
  return mkdtempSync(join(tmpdir(), 'sm-presets-'))
}

test('built-ins All/None always first', () => {
  const d = presetDir()
  const list = listPresets({ presetDir: d, skills: [{ id: 'a' }, { id: 'b' }] })
  rmSync(d, { recursive: true, force: true })
  assert.deepEqual(list.map(p => p.name), ['All', 'None'])
  assert.equal(list[0].count, 2)
  assert.equal(list[1].count, 0)
  assert.ok(list[0].builtin && list[1].builtin)
})

test('create → list → rename → delete round-trip', () => {
  const d = presetDir()
  try {
    createPreset('My Set', ['a', 'b'], { presetDir: d })
    assert.equal(listPresets({ presetDir: d, skills: [] }).find(p => p.name === 'My Set').count, 2)
    renamePreset('My Set', 'Renamed', { presetDir: d })
    assert.ok(listPresets({ presetDir: d, skills: [] }).find(p => p.name === 'Renamed'))
    deletePreset('Renamed', { presetDir: d })
    assert.ok(!listPresets({ presetDir: d, skills: [] }).find(p => p.name === 'Renamed'))
  } finally {
    rmSync(d, { recursive: true, force: true })
  }
})

test('create duplicate → 409; delete missing → 404', () => {
  const d = presetDir()
  try {
    createPreset('X', ['a'], { presetDir: d })
    assert.throws(() => createPreset('X', ['b'], { presetDir: d }), e => e.status === 409)
    assert.throws(() => deletePreset('Nope', { presetDir: d }), e => e.status === 404)
  } finally {
    rmSync(d, { recursive: true, force: true })
  }
})

test('apply: listed skills enabled, all others disabled', () => {
  const d = presetDir()
  const calls = []
  try {
    createPreset('X', ['a'], { presetDir: d })
    const skills = [
      { id: 'a', enabled: false },
      { id: 'b', enabled: true },
      { id: 'c', enabled: true }
    ]
    const r = applyPreset('X', { presetDir: d, skills, toggle: id => calls.push(id) })
    assert.deepEqual(calls.sort(), ['a', 'b', 'c']) // a on, b+c off
    assert.deepEqual(r.enabled, ['a'])
  } finally {
    rmSync(d, { recursive: true, force: true })
  }
})

test('apply unknown preset → 404', () => {
  const d = presetDir()
  rmSync(d, { recursive: true, force: true })
  assert.throws(() => applyPreset('Ghost', { presetDir: d, skills: [] }), e => e.status === 404)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/presets.test.js`
Expected: FAIL — "Cannot find module '../server/lib/presets.js'"

- [ ] **Step 3: Implement `server/lib/presets.js`**

```js
import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getRoots } from '../roots.js'
import { scanSkills } from './scan.js'
import { toggleSkill } from './toggle.js'

function httpError(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

export function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function readAll(presetDir) {
  if (!existsSync(presetDir)) return []
  return readdirSync(presetDir).filter(f => f.endsWith('.json')).map(f => {
    const p = JSON.parse(readFileSync(join(presetDir, f), 'utf8'))
    return { name: p.name, builtin: false, skills: p.skills || [], count: (p.skills || []).length }
  })
}

export function listPresets({ presetDir = getRoots().presetDir, skills = scanSkills() } = {}) {
  return [
    { name: 'All', builtin: true, skills: skills.map(s => s.id), count: skills.length },
    { name: 'None', builtin: true, skills: [], count: 0 },
    ...readAll(presetDir)
  ]
}

export function createPreset(name, skills, { presetDir = getRoots().presetDir } = {}) {
  if (!name || typeof name !== 'string') throw httpError(400, 'name required')
  if (!Array.isArray(skills)) throw httpError(400, 'skills must be an array')
  mkdirSync(presetDir, { recursive: true })
  const file = join(presetDir, slug(name) + '.json')
  if (existsSync(file)) throw httpError(409, 'preset exists')
  writeFileSync(file, JSON.stringify({ name, skills }, null, 2))
  return { name, builtin: false, skills, count: skills.length }
}

export function renamePreset(oldName, newName, { presetDir = getRoots().presetDir } = {}) {
  const oldFile = join(presetDir, slug(oldName) + '.json')
  if (!existsSync(oldFile)) throw httpError(404, 'preset not found')
  const p = JSON.parse(readFileSync(oldFile, 'utf8'))
  const newFile = join(presetDir, slug(newName) + '.json')
  if (existsSync(newFile)) throw httpError(409, 'name taken')
  p.name = newName
  renameSync(oldFile, newFile)
  writeFileSync(newFile, JSON.stringify(p, null, 2))
  return { name: newName, builtin: false, skills: p.skills, count: p.skills.length }
}

export function deletePreset(name, { presetDir = getRoots().presetDir } = {}) {
  const file = join(presetDir, slug(name) + '.json')
  if (!existsSync(file)) throw httpError(404, 'preset not found')
  unlinkSync(file)
}

export function applyPreset(name, { presetDir = getRoots().presetDir, skills = scanSkills(), toggle = toggleSkill } = {}) {
  const preset = listPresets({ presetDir, skills }).find(p => p.name === name)
  if (!preset) throw httpError(404, 'preset not found')
  const wanted = new Set(preset.skills)
  for (const s of skills) {
    if (s.enabled !== wanted.has(s.id)) toggle(s.id)
  }
  return { enabled: skills.filter(s => wanted.has(s.id)).map(s => s.id) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/lib/presets.js test/presets.test.js
git commit -m "feat: presets library — CRUD + apply semantics"
```

### Task 7: Presets API

**Files:**
- Modify: `server/app.js` (add 5 preset routes)
- Test: `test/api.test.js` (append preset tests)

**Interfaces:**
- Consumes: presets library (Task 6), `createApp` (Task 5)
- Produces: `GET/POST /api/presets`, `PATCH/DELETE /api/presets/:name`, `POST /api/presets/apply`

- [ ] **Step 1: Append failing tests to `test/api.test.js`**

```js
test('presets: built-ins + create + apply + delete over HTTP', async () => {
  let r = await fetch(`${base}/api/presets`)
  assert.deepEqual((await r.json()).presets.map(p => p.name).slice(0, 2), ['All', 'None'])

  r = await fetch(`${base}/api/presets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'HTTP Set', skills: [] })
  })
  assert.equal(r.status, 200)

  r = await fetch(`${base}/api/presets/apply`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset: 'HTTP Set' })
  })
  const applied = await r.json()
  assert.deepEqual(applied.enabled, []) // empty set → disable all

  r = await fetch(`${base}/api/presets/HTTP%20Set`, { method: 'DELETE' })
  assert.equal(r.status, 204)
})

test('DELETE built-in preset → 409', async () => {
  const r = await fetch(`${base}/api/presets/All`, { method: 'DELETE' })
  assert.equal(r.status, 409)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/api.test.js`
Expected: FAIL — 404 on `/api/presets` (no route yet)

- [ ] **Step 3: Add routes to `server/app.js`**

Add import at top:
```js
import { listPresets, createPreset, renamePreset, deletePreset, applyPreset } from './lib/presets.js'
```

Add routes before the `express.static` line:
```js
  app.get('/api/presets', (req, res) => {
    res.json({ presets: listPresets() })
  })

  app.post('/api/presets', (req, res) => {
    try {
      res.json(createPreset(req.body?.name, req.body?.skills))
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.patch('/api/presets/:name', (req, res) => {
    try {
      res.json(renamePreset(req.params.name, req.body?.name))
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.delete('/api/presets/:name', (req, res) => {
    if (['All', 'None'].includes(req.params.name)) {
      return res.status(409).json({ error: 'built-in presets cannot be deleted' })
    }
    try {
      deletePreset(req.params.name)
      res.status(204).end()
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.post('/api/presets/apply', (req, res) => {
    try {
      res.json(applyPreset(req.body?.preset))
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/app.js test/api.test.js
git commit -m "feat: presets API — list/create/rename/delete/apply"
```

### Task 8: Core UI — List, Toolbar, Toggle

**Files:**
- Modify: `src/App.vue` (full rewrite), `src/style.css` (full rewrite)
- Create: `src/components/Toolbar.vue`, `src/components/SkillRow.vue`

**Interfaces:**
- Consumes: `GET /api/skills`, `POST /api/skills/toggle`
- Produces: list UI with search/category/status filters, optimistic checkbox toggle, error toast

- [ ] **Step 1: Create `src/components/Toolbar.vue`**

```vue
<script setup>
defineProps({ categories: Array })
defineModel('search')
defineModel('category')
defineModel('status')
</script>

<template>
  <div class="toolbar">
    <input v-model="search" type="search" placeholder="Search skills…" />
    <select v-model="category">
      <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
    </select>
    <select v-model="status">
      <option>All</option>
      <option>Enabled</option>
      <option>Disabled</option>
    </select>
  </div>
</template>
```

- [ ] **Step 2: Create `src/components/SkillRow.vue`**

```vue
<script setup>
defineProps({ skill: Object })
defineEmits(['toggle', 'select'])
</script>

<template>
  <div class="row" @click="$emit('select', skill)">
    <input type="checkbox" class="toggle" :checked="skill.enabled"
      @click.stop @change="$emit('toggle', skill)" />
    <div>
      <div class="meta">
        <span class="name">{{ skill.name }}</span>
        <span class="cat">{{ skill.category }}</span>
      </div>
      <p class="desc" :title="skill.description">{{ skill.description }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Rewrite `src/App.vue`**

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import Toolbar from './components/Toolbar.vue'
import SkillRow from './components/SkillRow.vue'

const skills = ref([])
const search = ref('')
const category = ref('All')
const status = ref('All')
const toast = ref('')

async function refresh() {
  const r = await fetch('/api/skills')
  skills.value = (await r.json()).skills
}

const categories = computed(() =>
  ['All', ...new Set(skills.value.map(s => s.category))].sort())

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return skills.value
    .filter(s => !q || (s.name + ' ' + s.description).toLowerCase().includes(q))
    .filter(s => category.value === 'All' || s.category === category.value)
    .filter(s => status.value === 'All' || (status.value === 'Enabled') === s.enabled)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
})

const enabledCount = computed(() => skills.value.filter(s => s.enabled).length)

async function toggle(skill) {
  const was = skill.enabled
  skill.enabled = !was // optimistic
  try {
    const r = await fetch('/api/skills/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: skill.id })
    })
    if (!r.ok) throw new Error((await r.json()).error)
  } catch (e) {
    skill.enabled = was
    toast.value = e.message
    setTimeout(() => (toast.value = ''), 3000)
  }
  refresh()
}

onMounted(refresh)
</script>

<template>
  <header>
    <h1>Skill Manager</h1>
    <span class="stat">{{ enabledCount }} enabled · {{ skills.length - enabledCount }} disabled</span>
  </header>
  <Toolbar v-model:search="search" v-model:category="category" v-model:status="status" :categories="categories" />
  <main>
    <SkillRow v-for="s in filtered" :key="s.id" :skill="s" @toggle="toggle" />
    <p v-if="!filtered.length" class="empty">No skills match.</p>
  </main>
  <div v-if="toast" class="toast">{{ toast }}</div>
</template>
```

- [ ] **Step 4: Rewrite `src/style.css`** (dark default; light vars already declared, used in Task 9)

```css
:root, [data-theme="dark"] {
  --bg: #101418; --fg: #e6edf3; --muted: #8b949e; --accent: #3fb950;
  --card: #1a2027; --border: #2d333b;
}
[data-theme="light"] {
  --bg: #f6f8fa; --fg: #24292f; --muted: #656d76; --accent: #1a7f37;
  --card: #ffffff; --border: #d0d7de;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); }
header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; }
h1 { font-size: 18px; margin: 0; }
.stat { color: var(--muted); font-size: 13px; }
.toolbar { display: flex; gap: 8px; padding: 0 24px 12px; }
.toolbar input, .toolbar select {
  padding: 6px 10px; background: var(--card); color: var(--fg);
  border: 1px solid var(--border); border-radius: 6px; font-size: 13px;
}
.toolbar input { flex: 1; }
main { padding: 0 24px 40px; display: flex; flex-direction: column; gap: 6px; }
.row {
  display: grid; grid-template-columns: 24px 1fr; gap: 10px; align-items: start;
  padding: 10px 12px; background: var(--card); border: 1px solid var(--border);
  border-radius: 8px; cursor: pointer;
}
.row:hover { border-color: var(--accent); }
.toggle { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--accent); cursor: pointer; }
.meta { display: flex; gap: 8px; align-items: baseline; }
.name { font-weight: 600; font-size: 14px; }
.cat {
  font-size: 11px; color: var(--accent); border: 1px solid var(--accent);
  padding: 1px 6px; border-radius: 10px;
}
.desc { margin: 2px 0 0; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty { color: var(--muted); text-align: center; padding: 24px; }
.toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: #d1242f; color: #fff; padding: 8px 16px; border-radius: 6px; font-size: 13px;
}
```

- [ ] **Step 5: Build + manual verify**

Run: `npm run build && node server/index.js &` → open `http://127.0.0.1:4217`
Expected: ~106 rows; green checkboxes on enabled skills; search filters live; category + status selects work; header stats correct; clicking a checkbox toggles it — verify on disk: `ls ~/.agents/skills/brainstorming/` shows `SKILL.md.disabled` after unchecking, `SKILL.md` after re-checking. Then `kill %1`.

- [ ] **Step 6: Commit**

```bash
git add src/App.vue src/style.css src/components
git commit -m "feat: core UI — list, toolbar, optimistic toggle"
```

### Task 9: Detail Drawer + Light/Dark Theme

**Files:**
- Create: `src/components/DetailDrawer.vue`
- Modify: `src/App.vue` (wire `selected` + theme), `src/style.css` (drawer + theme button)

**Interfaces:**
- Consumes: `GET /api/skills/content?id=`
- Produces: row click → right drawer with rendered SKILL.md; theme toggle in header

- [ ] **Step 1: Create `src/components/DetailDrawer.vue`**

```vue
<script setup>
import { ref, watch } from 'vue'
import { marked } from 'marked'

const props = defineProps({ skill: { type: Object, default: null } })
defineEmits(['close'])
const body = ref('')

watch(() => props.skill, async (s) => {
  if (!s) { body.value = ''; return }
  const r = await fetch('/api/skills/content?id=' + encodeURIComponent(s.id))
  const data = await r.json()
  body.value = data.content ? marked.parse(data.content) : '(no content)'
}, { immediate: true })
</script>

<template>
  <aside v-if="skill" class="drawer">
    <button class="close" @click="$emit('close')">✕</button>
    <article class="md" v-html="body"></article>
  </aside>
</template>
```

- [ ] **Step 2: Wire into `src/App.vue`**

Add to `<script setup>`:
```js
import DetailDrawer from './components/DetailDrawer.vue'

const selected = ref(null)
const theme = ref(
  localStorage.getItem('sm-theme') ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
)
document.documentElement.dataset.theme = theme.value
function setTheme(t) {
  theme.value = t
  document.documentElement.dataset.theme = t
  localStorage.setItem('sm-theme', t)
}
```

In `<template>`: add `@select="selected = $event"` to the `SkillRow` tag, add after `</main>`:
```html
<DetailDrawer :skill="selected" @close="selected = null" />
```

- [ ] **Step 3: Add theme button to header** (replace the `<header>` block)

```html
<header>
  <h1>Skill Manager</h1>
  <div class="header-right">
    <span class="stat">{{ enabledCount }} enabled · {{ skills.length - enabledCount }} disabled</span>
    <button class="theme-btn" @click="setTheme(theme === 'dark' ? 'light' : 'dark')">
      {{ theme === 'dark' ? '☀' : '🌙' }}
    </button>
  </div>
</header>
```

- [ ] **Step 4: Append drawer styles to `src/style.css`**

```css
.header-right { display: flex; gap: 10px; align-items: center; }
.theme-btn { background: var(--card); color: var(--fg); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; cursor: pointer; }
.drawer {
  position: fixed; top: 0; right: 0; width: 480px; height: 100vh; z-index: 10;
  background: var(--card); border-left: 1px solid var(--border); padding: 20px 24px; overflow-y: auto;
}
.close { position: sticky; top: 0; float: right; background: none; border: 1px solid var(--border); color: var(--fg); border-radius: 6px; padding: 4px 10px; cursor: pointer; }
.md { font-size: 14px; line-height: 1.6; }
.md pre { background: var(--bg); padding: 10px; border-radius: 6px; overflow-x: auto; }
.md code { background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 13px; }
.md h1, .md h2, .md h3 { margin-top: 1em; }
```

- [ ] **Step 5: Build + manual verify**

Run: `npm run build && node server/index.js &` → open the app
Expected: clicking a row opens the drawer with rendered markdown (headings, code blocks); ✕ closes it; theme button swaps light/dark and persists across reload. Then `kill %1`.

- [ ] **Step 6: Commit**

```bash
git add src/components/DetailDrawer.vue src/App.vue src/style.css
git commit -m "feat: SKILL.md drawer + light/dark theme toggle"
```

### Task 10: Presets UI

**Files:**
- Create: `src/components/PresetMenu.vue`, `src/components/ConfirmDialog.vue`
- Modify: `src/App.vue` (presets state + handlers + header menu)

**Interfaces:**
- Consumes: `GET/POST /api/presets`, `PATCH/DELETE /api/presets/:name`, `POST /api/presets/apply`
- Produces: header Presets menu; apply-confirm dialog; save/rename/delete

- [ ] **Step 1: Create `src/components/ConfirmDialog.vue`**

```vue
<script setup>
defineProps({ title: String, skills: Array, disabledCount: Number })
defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div class="overlay" @click.self="$emit('cancel')">
    <div class="dialog">
      <h3>{{ title }}</h3>
      <p class="sub">{{ disabledCount }} other skills will be disabled.</p>
      <ul class="dlg-list">
        <li v-for="s in skills" :key="s">{{ s }}</li>
      </ul>
      <div class="actions">
        <button @click="$emit('cancel')">Cancel</button>
        <button class="primary" @click="$emit('confirm')">Apply</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create `src/components/PresetMenu.vue`**

```vue
<script setup>
defineProps({ presets: Array })
defineEmits(['apply', 'save', 'rename', 'delete'])
</script>

<template>
  <div class="preset-menu">
    <button class="pm-save" @click="$emit('save')">Save current as preset…</button>
    <div v-for="p in presets" :key="p.name" class="pm-row">
      <button @click="$emit('apply', p)">{{ p.name }} ({{ p.count }})</button>
      <template v-if="!p.builtin">
        <button class="mini" @click="$emit('rename', p)">rename</button>
        <button class="mini" @click="$emit('delete', p)">delete</button>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Wire into `src/App.vue`**

Add to `<script setup>`:
```js
import PresetMenu from './components/PresetMenu.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

const presets = ref([])
const dialogPreset = ref(null)
const menuOpen = ref(false)

async function refreshPresets() {
  const r = await fetch('/api/presets')
  presets.value = (await r.json()).presets
}

const dialogNames = computed(() => {
  if (!dialogPreset.value) return []
  const wanted = new Set(dialogPreset.value.skills)
  return skills.value.filter(s => wanted.has(s.id)).map(s => s.name)
})
const dialogDisabledCount = computed(() => {
  if (!dialogPreset.value) return 0
  const wanted = new Set(dialogPreset.value.skills)
  return skills.value.filter(s => !wanted.has(s.id)).length
})

function askApply(preset) {
  menuOpen.value = false
  dialogPreset.value = preset
}

async function doApply() {
  const p = dialogPreset.value
  dialogPreset.value = null
  const r = await fetch('/api/presets/apply', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset: p.name })
  })
  if (!r.ok) toast.value = (await r.json()).error
  refresh()
  refreshPresets()
}

async function savePreset() {
  const name = prompt('Preset name:')
  if (!name) return
  const r = await fetch('/api/presets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, skills: skills.value.filter(s => s.enabled).map(s => s.id) })
  })
  if (!r.ok) toast.value = (await r.json()).error
  menuOpen.value = false
  refreshPresets()
}

async function renamePreset(p) {
  const name = prompt('New name:', p.name)
  if (!name) return
  const r = await fetch('/api/presets/' + encodeURIComponent(p.name), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  if (!r.ok) toast.value = (await r.json()).error
  refreshPresets()
}

async function deletePreset(p) {
  if (!confirm(`Delete preset "${p.name}"?`)) return
  const r = await fetch('/api/presets/' + encodeURIComponent(p.name), { method: 'DELETE' })
  if (!r.ok && r.status !== 204) toast.value = (await r.json()).error
  refreshPresets()
}
```

Change `onMounted(refresh)` to `onMounted(() => { refresh(); refreshPresets() })`.

In the header's `.header-right` div, add before the theme button:
```html
<div class="menu-wrap">
  <button class="theme-btn" @click="menuOpen = !menuOpen">Presets ▾</button>
  <PresetMenu v-if="menuOpen" :presets="presets"
    @apply="askApply" @save="savePreset" @rename="renamePreset" @delete="deletePreset" />
</div>
```

After `<DetailDrawer …/>`:
```html
<ConfirmDialog v-if="dialogPreset"
  :title="`Apply preset \"${dialogPreset.name}\"?`"
  :skills="dialogNames" :disabled-count="dialogDisabledCount"
  @confirm="doApply" @cancel="dialogPreset = null" />
```

- [ ] **Step 4: Append menu/dialog styles to `src/style.css`**

```css
.menu-wrap { position: relative; display: flex; gap: 8px; align-items: center; }
.preset-menu {
  position: absolute; right: 0; top: 36px; z-index: 20; min-width: 240px;
  background: var(--card); border: 1px solid var(--border); border-radius: 8px;
  padding: 8px; display: flex; flex-direction: column; gap: 4px;
}
.pm-row { display: flex; gap: 4px; }
.pm-row button:first-child { flex: 1; text-align: left; }
.preset-menu button {
  background: none; border: none; color: var(--fg); padding: 6px 8px;
  border-radius: 6px; cursor: pointer; font-size: 13px; text-align: left;
}
.preset-menu button:hover { background: var(--bg); }
.mini { color: var(--muted); font-size: 11px; }
.overlay { position: fixed; inset: 0; z-index: 30; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; }
.dialog { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; width: 420px; max-height: 70vh; display: flex; flex-direction: column; }
.dlg-list { overflow-y: auto; margin: 8px 0; padding-left: 18px; font-size: 13px; color: var(--muted); }
.sub { color: var(--muted); font-size: 13px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.actions button { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border); background: none; color: var(--fg); cursor: pointer; }
.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
```

- [ ] **Step 5: Build + manual verify**

Run: `npm run build && node server/index.js &` → open the app
Expected: Presets ▾ shows `All (N)` / `None (0)` + user presets; applying `None` opens the dialog ("N other skills will be disabled") → confirm → all checkboxes off (spot-check 3 dirs on disk for `SKILL.md.disabled`); "Save current as preset…" prompts for name, then appears in menu; rename/delete work on user presets only; built-ins show no rename/delete. Then `kill %1`.

- [ ] **Step 6: Commit**

```bash
git add src/components/PresetMenu.vue src/components/ConfirmDialog.vue src/App.vue src/style.css
git commit -m "feat: presets UI — menu, apply dialog, save/rename/delete"
```

### Task 11: End-to-End Verification + README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything
- Produces: verified working app + docs

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all green (categories, scan, toggle, api, presets)

- [ ] **Step 2: E2E with real skills**

Run: `./run.sh` (opens browser)
1. Toggle a real skill (e.g. `brainstorming`) off → verify on disk: `ls ~/.agents/skills/brainstorming/` shows `SKILL.md.disabled`; pi symlink still resolves: `ls ~/.pi/agent/skills/brainstorming/`
2. Toggle it back on → `SKILL.md` restored
3. Apply preset `None` → confirm dialog → all checkboxes off (spot-check 3 dirs); apply `All` → all restored
4. Header counts match the on-disk state

- [ ] **Step 3: Write `README.md`**

```md
# Skill Manager

Local web app to manage global coding-agent skills (`~/.agents/skills`, `~/.pi/agent/skills`).
Every enabled `SKILL.md`'s name+description is injected into agent system prompts —
disable skills here to cut context bloat.

## Run

./run.sh   # installs deps if needed, builds, serves http://127.0.0.1:4217

## How it works

- Toggle = rename `SKILL.md` ↔ `SKILL.md.disabled` in the canonical dir
  (pi symlinks resolve there, so one toggle covers all agents)
- Categories are heuristic (keyword match on name+description) — not stored
- Presets are JSON files in `presets/`; applying a preset makes the enabled
  set exactly equal to the preset's set
- Built-in presets: `All`, `None`

## Tests

npm test   # node:test, temp fixtures only — never touches real skills
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README + e2e verified"
```

## Self-Review (planner checklist — run after all tasks written)

- **Spec coverage:** scan (T3) ✓, toggle (T4) ✓, skills API (T5) ✓, presets lib+API (T6/T7) ✓, categories (T2) ✓, UI list/search/filter/checkbox (T8) ✓, drawer (T9) ✓, theme (T9) ✓, presets UI (T10) ✓, run.sh (T1) ✓, tests (T2–T7) ✓, E2E (T11) ✓
- **Spec gap added:** `GET /api/skills/content` (needed by drawer, not in spec API section) — added in T5
- **Placeholder scan:** none — every step has code or exact commands
- **Type consistency:** Skill shape `{ id, name, description, enabled, category, source }` across T3/T5/T8; preset shape `{ name, builtin, skills, count }` across T6/T7/T10; component props/emits per notes appendix

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
