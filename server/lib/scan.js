import { readdirSync, statSync, existsSync, realpathSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { categorize } from '../../shared/categories.js'
import { getRoots } from '../roots.js'

function safeRead(p) {
  try { return readFileSync(p, 'utf8') } catch { return null }
}

// Resolve an existing root to its real path so realpath'd skill dirs share a
// comparable prefix (macOS /var -> /private/var symlink breaks raw prefixes).
function resolveExisting(p) {
  if (!existsSync(p)) return null
  try { return realpathSync(p) } catch { return p }
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
  const realAgents = resolveExisting(roots.agentsRoot)
  const realPi = resolveExisting(roots.piRoot)
  const found = []
  for (const root of [realAgents, realPi]) {
    if (root) walk(root, found, 0)
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
      source: realAgents && real.startsWith(realAgents + '/') ? 'agents' : 'pi'
    })
  }
  return skills
}
