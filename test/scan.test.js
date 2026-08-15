// test/scan.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanSkills, parseFrontmatter } from '../server/lib/scan.js'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'sm-scan-'))
  const agents = join(root, 'agents')
  const pi = join(root, 'pi')
  const mk = (dir, file, content) => {
    mkdirSync(join(agents, dir), { recursive: true })
    writeFileSync(join(agents, dir, file), content)
  }
  mk('alpha', 'SKILL.md', '---\nname: alpha\ndescription: A test skill\n---\n# Alpha')
  mk('grp/beta', 'SKILL.md', '---\nname: beta\ndescription: "Nested skill"\n---\n# Beta')
  mk('gamma', 'SKILL.md.disabled', '---\nname: gamma\ndescription: off\n---\n# Gamma')
  mkdirSync(join(agents, 'empty'), { recursive: true })
  writeFileSync(join(agents, 'empty/README.md'), 'no skill here')
  mkdirSync(join(pi, 'solo'), { recursive: true })
  writeFileSync(join(pi, 'solo/SKILL.md'), '---\nname: solo\ndescription: standalone\n---\n# Solo')
  symlinkSync(join(agents, 'grp'), join(pi, 'grp')) // pi-style group symlink
  return { root, agents, pi }
}

test('scan finds flat + nested, dedupes symlinks, excludes empty dirs', () => {
  const { root, agents, pi } = fixture()
  try {
    const skills = scanSkills({ agentsRoot: agents, piRoot: pi })
    const names = skills.map(s => s.name).sort()
    assert.deepEqual(names, ['alpha', 'beta', 'gamma', 'solo'])
    assert.equal(skills.find(s => s.name === 'gamma').enabled, false)
    assert.equal(skills.find(s => s.name === 'solo').source, 'pi')
    assert.equal(skills.find(s => s.name === 'beta').source, 'agents')
    assert.equal(skills.find(s => s.name === 'beta').description, 'Nested skill') // quoted fm
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('parseFrontmatter tolerates missing block', () => {
  assert.deepEqual(parseFrontmatter('# no frontmatter'), {})
})
