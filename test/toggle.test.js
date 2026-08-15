// test/toggle.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync, rmSync } from 'node:fs'
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

test('dir that is not a skill → 400', () => {
  const root = mkdtempSync(join(tmpdir(), 'sm-toggle-'))
  const empty = join(root, 'empty')
  mkdirSync(empty)
  try {
    assert.throws(() => toggleSkill(empty, { agentsRoot: root, piRoot: root }),
      e => e.status === 400)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('external symlink target is toggleable (canonical dir outside roots)', () => {
  const root = mkdtempSync(join(tmpdir(), 'sm-toggle-'))
  const ext = join(root, 'external', 'sk')
  mkdirSync(ext, { recursive: true })
  writeFileSync(join(ext, 'SKILL.md'), '---\nname: ext\n---\n')
  const pi = join(root, 'pi')
  mkdirSync(pi)
  symlinkSync(join(root, 'external'), join(pi, 'extlink')) // group symlink → external skill
  const roots = { agentsRoot: join(root, 'agents'), piRoot: pi }
  try {
    const r = toggleSkill(ext, roots)
    assert.equal(r.enabled, false)
    assert.ok(existsSync(join(ext, 'SKILL.md.disabled')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('path outside managed roots → 400', () => {
  assert.throws(() => toggleSkill('/etc', { agentsRoot: '/tmp/a', piRoot: '/tmp/b' }),
    e => e.status === 400)
})
