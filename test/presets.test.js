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
