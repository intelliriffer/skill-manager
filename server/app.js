import express from 'express'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { scanSkills } from './lib/scan.js'
import { toggleSkill, assertManagedDir } from './lib/toggle.js'

const APP_ROOT = dirname(fileURLToPath(import.meta.url))

function safeRead(p) {
  try { return readFileSync(p, 'utf8') } catch { return null }
}

export function createApp() {
  const app = express()
  app.use(express.json())

  app.get('/api/skills', (req, res) => {
    res.json({ skills: scanSkills() })
  })

  app.post('/api/skills/toggle', (req, res) => {
    try {
      res.json(toggleSkill(req.body?.id))
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.get('/api/skills/content', (req, res) => {
    try {
      const dir = assertManagedDir(String(req.query.id || ''))
      const content = safeRead(join(dir, 'SKILL.md')) ?? safeRead(join(dir, 'SKILL.md.disabled'))
      if (content == null) return res.status(404).json({ error: 'not found' })
      res.json({ content })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.use(express.static(join(APP_ROOT, '..', 'dist')))
  return app
}
