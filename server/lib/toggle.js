// server/lib/toggle.js
import { renameSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getRoots } from '../roots.js'

export class HttpError extends Error { status = 500; constructor(status, msg) { super(msg); this.status = status } }

export function assertManagedDir(id, roots = getRoots()) {
  const real = resolve(String(id))
  const ok = [roots.agentsRoot, roots.piRoot].some(r => real === r || real.startsWith(r + '/'))
  if (!ok) throw new HttpError(400, 'id is not a managed skill dir')
  return real
}

export function toggleSkill(id, roots = getRoots()) {
  const real = assertManagedDir(id, roots)
  const on = join(real, 'SKILL.md')
  const off = join(real, 'SKILL.md.disabled')
  if (existsSync(on)) { renameSync(on, off); return { id: real, enabled: false } }
  if (existsSync(off)) { renameSync(off, on); return { id: real, enabled: true } }
  throw new HttpError(409, 'skill has no SKILL.md')
}
