# Skill Manager — Technical Details (for AI agents)

> Read this before any feature work or fix. It captures what this project is,
> how it works, every design decision, and the invariants you must not break.
> Human-facing docs: `README.md`. Spec: `docs/superpowers/specs/2026-08-15-skill-manager-design.md`.
> Plan (all tasks complete): `docs/superpowers/plans/2026-08-15-skill-manager.md`.

## 1. What this is

A local single-process web app (Express + Vue 3, one port `:4217`) that manages
the user's **global coding-agent skills** across two directories:

- `~/.agents/skills/` — canonical store (real dirs, flat or nested in group dirs)
- `~/.pi/agent/skills/` — mostly symlinks into the canonical store, plus a few
  real dirs (`supacode-cli`) and external symlinks (`mrweb` → `~/DEV/mrweb/mrweb`)

**Why it exists:** every enabled `SKILL.md`'s name+description is injected into
coding agents' system prompts. Disabling skills here literally cuts context
bloat. The app lists all skills with search/filter, toggles them, and offers
presets (All/None + user-saved sets).

**The core mechanism:** toggling = renaming `SKILL.md` ↔ `SKILL.md.disabled`
**in the canonical directory** (symlinks resolve there, so one toggle covers
every agent pointing at the skill). Agents simply fail to find `SKILL.md` and
skip the skill. Nothing is moved, copied, deleted, or rewritten.

## 2. Architecture

```
run.sh ──► npm install (if needed) ──► vite build ──► node server/index.js ──► open browser
                                                                    │
                                              Express app on 127.0.0.1:4217
                                              ├─ /api/*  (JSON, see §4)
                                              └─ /       (serves dist/ static build)
```

- **One process, one port.** `server/index.js` is a thin bootstrap
  (`createApp().listen(4217, '127.0.0.1')`). `server/app.js` exports
  `createApp()` — importable by tests (tests call it with `listen(0)`).
- **Frontend** is a Vue 3 SPA built by Vite into `dist/`, served as static
  files by the same Express app. No router, no state lib, no build-time API
  proxy — the UI fetches same-origin `/api/*`.
- **No database.** State is the filesystem itself (skill dirs + `presets/*.json`).
  Every API read re-scans the real dirs (fresh truth, ~107 dirs, tens of ms).

### File map

| File | Role |
|---|---|
| `run.sh` | single entry: install → build → serve → open browser |
| `server/index.js` | bootstrap: `createApp().listen(4217, '127.0.0.1')` |
| `server/app.js` | `createApp()` — express, json, all routes, static `dist/` |
| `server/roots.js` | `getRoots()` → `{ agentsRoot, piRoot, presetDir }` (env-overridable, §7) |
| `server/lib/scan.js` | recursive skill scan, realpath dedupe, frontmatter parse |
| `server/lib/toggle.js` | `toggleSkill()`, `assertManagedDir()`, `HttpError` class |
| `server/lib/presets.js` | preset CRUD + `applyPreset` (built-ins All/None + user JSON files) |
| `shared/categories.js` | `categorize(name, description)` heuristic (used by scan) |
| `src/App.vue` | all state + handlers (see §5) |
| `src/components/Toolbar.vue` | search box + category/status selects (`defineModel`) |
| `src/components/SkillRow.vue` | one row: checkbox, name, category badge, description |
| `src/components/DetailDrawer.vue` | right 480px panel, markdown preview via `marked` |
| `src/components/PresetMenu.vue` | header dropdown: save/apply/rename/delete |
| `src/components/ConfirmDialog.vue` | centered overlay for apply confirmation |
| `src/style.css` | CSS vars under `[data-theme="dark"|"light"]`; dark = default |
| `test/*.test.js` | node:test suites (categories, scan, toggle, api, presets) |
| `presets/` | **runtime user data — gitignored, never commit** |

## 3. Core mechanisms

### 3.1 Scan (`server/lib/scan.js`)

`scanSkills(roots = getRoots())` → `Skill[]`:

```js
Skill = { id, name, description, enabled, category, source }
// id        = realpath of the skill dir (canonical)
// name      = frontmatter `name:` or basename
// enabled   = existsSync(id/SKILL.md)   (false ⇔ SKILL.md.disabled present)
// source    = 'agents' | 'pi' — the root through which it was discovered
```

- Walks each root **recursively** (depth ≤ 6). A dir containing `SKILL.md` or
  `SKILL.md.disabled` is a **skill dir — never descended into**. Other dirs
  (group dirs like `ops-and-setup/`) are descended.
- **Dedupe by `realpath`** — first root walked wins (`agents` first, then `pi`).
  This is why pi's symlinks into the canonical store don't double-list.
- **External symlink targets ARE listed** (design decision B, user-approved
  2026-08-15): `artisto` (in agents root) and `mrweb` (in pi root) point
  outside both roots; they are listed and toggleable (see §6.1).
- `parseFrontmatter(text)` — minimal `---` block parser, tolerant of missing
  block; returns `{}` on garbage.
- Error handling: every throwing fs call is wrapped (`safeRead`, try/catch on
  `readdirSync`/`statSync`/`realpathSync`) — broken symlinks and unreadable
  dirs are skipped, never crash the scan.
- Roots are **realpath'd before walking** (`resolveExisting`) — required on
  macOS where `tmpdir()`/`$TMPDIR` paths under `/var` resolve to `/private/var`
  (see §6.2).

### 3.2 Toggle (`server/lib/toggle.js`)

```js
toggleSkill(id, roots = getRoots(), managedIds = null) → { id, enabled }
assertManagedDir(id, roots = getRoots(), managedIds = null) → realPath
```

- `assertManagedDir` resolves `id` to its realpath and requires it to be a
  member of the **scan set** (`managedIds` if provided, else a fresh
  `scanSkills(roots)`). This is the security gate: arbitrary paths (e.g.
  `/etc`) are never in the set → `HttpError(400, 'id is not a managed skill dir')`.
  `managedIds` exists so batch apply doesn't rescan per skill.
- Then: if `SKILL.md` exists → `renameSync` to `SKILL.md.disabled`, return
  `{ enabled: false }`; else if `SKILL.md.disabled` exists → rename back,
  `{ enabled: true }`; else `HttpError(409)` (dir is not a skill — race only).
- **Safety invariant: only ever renames `SKILL.md`/`SKILL.md.disabled` inside
  scanned skill dirs. No deletes. No writes anywhere else.**

### 3.3 Categories (`shared/categories.js`)

`categorize(name, description)` → first matching rule wins, else `'General'`.
Ordered `RULES = [[category, [regexFragments]], ...]`; a fragment matches if
`new RegExp(frag, 'i').test(name + ' ' + description)`. **Heuristic only —
never stored, recomputed on every scan.** Fragments use word boundaries where
precision matters (`\bart\b` so "artifacts" ≠ Design; `\bplans?\b` so
"plannotator" ≠ Planning; `\bmcp\b`, `\bagents?\b`, `\bpdf\b`) and stems
elsewhere (`\bdiagnos`, `\borchestrat`, `\bspec`, `\bdesign`, `\bsearch`).
Categories: Coding, Design, Docs, Research, Testing, Planning, Agent,
Web, Ops, Media, General (order per spec table — matters for first-match).

### 3.4 Presets (`server/lib/presets.js`)

- **Built-ins** (computed, not files): `All` = every scanned skill id;
  `None` = `[]`. They always come first in the list and are **undeletable
  (409) and unrenamable**.
- **User presets**: JSON files in `presetDir` (`presets/`), one per preset:
  `{ name, skills: [id...] }`, filename `slug(name) + '.json'`
  (`slug` = lowercase, non-alnum → `-`).
- `listPresets({ presetDir, skills })` → `[ { name, builtin, skills, count } ]`
  where `count` = how many of the preset's ids are currently enabled.
- `applyPreset(name, { presetDir, skills, toggle = toggleSkill })` — makes the
  enabled set **exactly equal** to the preset's set: for each scanned skill,
  if `s.enabled !== wanted.has(s.id)` → `toggle(s.id, undefined, ids)` (ids =
  precomputed scan set). Returns `{ enabled: [...] }`. **Not transactional** —
  a mid-apply failure leaves a partial state (accepted; local single-user app).
- `createPreset` / `renamePreset` / `deletePreset` — plain file ops;
  409 on name collision, 404 on missing, 409 on built-in delete.

## 4. API (all JSON, same-origin)

| Route | Body | Success | Errors |
|---|---|---|---|
| `GET /api/skills` | — | `{ skills: Skill[] }` (fresh scan) | — |
| `POST /api/skills/toggle` | `{ id }` | `{ id, enabled }` | 400 not-a-scan-member, 409 no SKILL.md |
| `GET /api/skills/content?id=` | — | `{ content }` (SKILL.md or .disabled text) | 400/404 |
| `GET /api/presets` | — | `{ presets: [{ name, builtin, skills, count }] }` | — |
| `POST /api/presets` | `{ name, skills }` | created preset | 409 name taken |
| `PATCH /api/presets/:name` | `{ name }` | renamed preset | 404/409 |
| `DELETE /api/presets/:name` | — | 204 | 409 built-in, 404 missing |
| `POST /api/presets/apply` | `{ preset }` | `{ enabled: [id...] }` | 404 unknown preset |

Error shape everywhere: `{ error: message }` with the `HttpError.status`
(500 default). `server/app.js` maps `HttpError` → status; unknown throw → 500.
