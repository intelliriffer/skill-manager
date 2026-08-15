import express from 'express'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { scanSkills } from './lib/scan.js'
import { toggleSkill, assertManagedDir } from './lib/toggle.js'
import { listPresets, createPreset, renamePreset, deletePreset, applyPreset } from './lib/presets.js'

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


  app.get('/api/presets', (req, res) => {
    res.json({ presets: listPresets() })
  })

  app.post('/api/presets', (req, res) => {
    try {
      res.json(createPreset(req.body?.name, req.body?.skills))
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.patch('/api/presets/:name', (req, res) => {
    try {
      res.json(renamePreset(req.params.name, req.body?.name))
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.delete('/api/presets/:name', (req, res) => {
    if (['All', 'None'].includes(req.params.name)) {
      return res.status(409).json({ error: 'built-in presets cannot be deleted' })
    }
    try {
      deletePreset(req.params.name)
      res.status(204).end()
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.post('/api/presets/apply', (req, res) => {
    try {
      res.json(applyPreset(req.body?.preset))
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
  })

  app.use(express.static(join(APP_ROOT, '..', 'dist')))
  return app
}
