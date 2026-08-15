// server/lib/toggle.js
import { renameSync, existsSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getRoots } from '../roots.js'
import { scanSkills } from './scan.js'

export class HttpError extends Error { status = 500; constructor(status, msg) { super(msg); this.status = status } }

function resolveExisting(p) {
  try { return realpathSync(p) } catch { return p }
}

// id must be the canonical dir of a skill the scan reached via a managed root
// (covers external symlink targets; arbitrary paths are never in the set).
// managedIds: precomputed Set of scan ids — skips a rescan in batch apply.
export function assertManagedDir(id, roots = getRoots(), managedIds = null) {
  const real = resolveExisting(resolve(String(id)))
  const ok = managedIds ? managedIds.has(real) : new Set(scanSkills(roots).map(s => s.id)).has(real)
  if (!ok) throw new HttpError(400, 'id is not a managed skill dir')
  return real
}

export function toggleSkill(id, roots = getRoots(), managedIds = null) {
  const real = assertManagedDir(id, roots, managedIds)
  const on = join(real, 'SKILL.md')
  const off = join(real, 'SKILL.md.disabled')
  if (existsSync(on)) { renameSync(on, off); return { id: real, enabled: false } }
  if (existsSync(off)) { renameSync(off, on); return { id: real, enabled: true } }
  throw new HttpError(409, 'skill has no SKILL.md')
}
