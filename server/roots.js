import { resolve, join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const APP_ROOT = dirname(fileURLToPath(import.meta.url))

export function getRoots() {
  return {
    agentsRoot: resolve(process.env.SKILL_AGENTS_ROOT || join(homedir(), '.agents', 'skills')),
    piRoot: resolve(process.env.SKILL_PI_ROOT || join(homedir(), '.pi', 'agent', 'skills')),
    presetDir: resolve(process.env.SKILL_PRESET_DIR || join(APP_ROOT, '..', 'presets'))
  }
}
