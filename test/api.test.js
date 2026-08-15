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
  process.env.SKILL_PRESET_DIR = join(root, 'presets')
  const { createApp } = await import('../server/app.js')
  server = createApp().listen(0)
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
  rmSync(root, { recursive: true, force: true })
  delete process.env.SKILL_AGENTS_ROOT
  delete process.env.SKILL_PI_ROOT
  delete process.env.SKILL_PRESET_DIR
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
