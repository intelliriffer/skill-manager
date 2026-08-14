# Skill Manager — Design Spec

Date: 2026-08-15
Status: approved via brainstorming
Project: /Volumes/T7DATA/AIDEV/skill-manager

## Purpose

Local Vue 3 web app to manage the global coding-agent skill store on this
machine. Primary goal: prevent context bloat — every enabled `SKILL.md`'s
name+description is injected into agent system prompts, so skills can be
toggled off with one click.

Managed locations:

- `~/.agents/skills` — canonical store (real directories)
- `~/.pi/agent/skills` — symlinks into the canonical store + standalone entries

Out of scope: per-agent visibility, symlink management, skill editing,
deletion, other agent directories (Claude Code, OpenCode, Pi consume the
same enabled set; Claude Code does not read these dirs).

## Stack

- Vue 3 + Vite (frontend, built to `dist/`)
- Node.js + Express (backend, serves `dist/` + JSON API)
- Single process, single port `:4217`, bound to `127.0.0.1`
- `run.sh`: `npm install` (if `node_modules` missing) → `vite build` (always,
  fast) → `node server/index.js` → open browser

## Data Model

Skill entry (built server-side per scan):

- `id` — resolved absolute directory path (unique key)
- `name` — frontmatter `name` (fallback: dir basename)
- `description` — frontmatter `description` (fallback: `""`)
- `enabled` — true if `SKILL.md` exists in resolved dir
- `category` — heuristic string
- `source` — `'agents' | 'pi'`

## Scan Logic (`server/lib/scan.js`)

Skills sit at any depth: flat (`~/.agents/skills/brainstorming/`) or nested
inside group dirs (`~/.agents/skills/ops-and-setup/anti-sleep/`). Group dirs
may be real dirs or symlinks (pi uses group symlinks).

1. Recursively walk `~/.agents/skills` (following symlinks)
2. Recursively walk `~/.pi/agent/skills` (following symlinks)
3. A skill = any directory containing `SKILL.md` or `SKILL.md.disabled`;
   all other directories are ignored
4. Dedupe by `fs.realpath` of the skill dir — pi's symlinks (flat or via
   group dirs) resolve into `~/.agents/skills` and collapse to one entry
5. `source`: `'agents'` if realpath is under `~/.agents/skills`, else `'pi'`
   (standalone entries, e.g. `supacode-cli`, `mrweb`)
6. `enabled` = `SKILL.md` exists in the skill dir
7. Frontmatter: parse leading `---` block with regex; `name`/`description`
   keys; tolerate quoted values; fallback to dir basename

Scale: ~104 skills in the canonical store + 2 standalone ≈ 106 entries.

## Toggle (`server/lib/toggle.js`)

`POST /api/skills/toggle` with `{ id }`:

- validate `id` is a scanned skill dir (must be under a managed root;
  reject path traversal)
- if `SKILL.md` exists → rename to `SKILL.md.disabled`
- else if `SKILL.md.disabled` exists → rename to `SKILL.md`
- else → `409` (no `SKILL.md` or `SKILL.md.disabled`)
- returns `{ id, enabled }`

Safety: only ever renames `SKILL.md` / `SKILL.md.disabled` inside scanned
dirs. No deletes, no writes outside managed roots.

## API

- `GET /api/skills` → `{ skills: [...] }` (fresh scan per call, ~106 dirs)
- `POST /api/skills/toggle` → `{ id, enabled }` or error

## Categories (`shared/categories.js`)

Heuristic keyword rules on lowercased name+description, first match wins,
default `General`. Matching is case-insensitive with word boundaries
(`plan` must not match `plannotator`); dotted filenames (`SKILL.md`,
`AGENTS.md`) match as literal substrings. Ordered rules (order matters):

| Category | Keywords |
|---|---|
| Skill Authoring | skill, SKILL.md, AGENTS.md |
| Documents | pdf, docx, pptx, xlsx, spreadsheet, word |
| Git | git, branch, merge, rebase, commit, cherry |
| Debugging | debug, diagnos, regression |
| Testing | test, tdd, red-green |
| Planning | brainstorm, spec, plan, proposal |
| Design & Visual | design, logo, art, theme, canvas, poster, gif |
| Research & Web | search, web, scrape, crawl, fetch, research, transcript |
| MCP | mcp |
| Agents | agent, subagent, orchestrat, dispatch |
| Ops & Setup | server, vps, ops, setup, provision, ssh, deploy |
| Prompting | prompt, goal, loop, instruction |

## UI

Single page, no router:

- **Header**: "Skill Manager" + stat `N enabled · M disabled`
- **Toolbar**: search input (name+description), category select (All +
  categories present in the list), status select (All / Enabled / Disabled)
- **List**: rows sorted category → name:
  - checkbox: green checked = enabled, empty = disabled; click = optimistic
    flip → `POST /api/skills/toggle` → refetch
  - name (bold), description (1-line truncate, full text in tooltip)
  - category tag
- **Row click** → right drawer: full SKILL.md rendered as markdown, read-only
- **Error toast** on failed toggle; checkbox reverts

## Error Handling

- Dir with neither `SKILL.md` nor `SKILL.md.disabled` is excluded from the
  listing entirely; toggle API still answers `409` for such ids (defensive)
- API failure → toast, UI reverts
- Bind `127.0.0.1` only; no auth (localhost tool)

## Testing

- `node:test` suite in `test/`:
  - **scan**: fixture tree with flat skill, nested group skill, symlinked
    group dir (pi-style), external symlink, real dir, disabled skill, and a
    dir with no SKILL.md (must be excluded) → expected entries + dedupe
  - **toggle**: enable/disable round-trip on fixture; dir with no
    SKILL.md → 409; path traversal rejected
  - **categories**: sample strings per rule
- Fixtures in a temp dir (`fs.mkdtemp`); tests never touch real
  `~/.agents/skills`
- Manual: `run.sh` → toggle a skill → verify on-disk rename → verify a fresh
  agent session no longer lists the skill

## Project Layout

```
skill-manager/
├── run.sh
├── package.json
├── vite.config.js
├── server/index.js
├── server/lib/scan.js
├── server/lib/toggle.js
├── shared/categories.js
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── components/Toolbar.vue
│   ├── components/SkillRow.vue
│   └── components/DetailDrawer.vue
└── test/
    ├── scan.test.js
    ├── toggle.test.js
    └── categories.test.js
```
