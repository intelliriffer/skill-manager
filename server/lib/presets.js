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
