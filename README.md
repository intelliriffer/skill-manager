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
