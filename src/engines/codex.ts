import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../config.js'
import type { Engine } from './types.js'

export const CODEX_HOME = join(paths.dir, 'codex', 'home')
export const CODEX_REPOS_BASE = join(paths.dir, 'codex', 'repos')
export const CODEX_WORK_BASE = join(paths.dir, 'codex', 'work')

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export const codexEngine: Engine = {
  id: 'codex',
  label: 'Codex',
  recommended: true,
  models: [],
  efforts: ['minimal', 'low', 'medium', 'high'],
  auth: {
    mode: 'login-command',
    command: `CODEX_HOME=${shellQuote(CODEX_HOME)} codex login`,
  },

  isConfigured(): boolean {
    return existsSync(join(CODEX_HOME, 'auth.json'))
  },

  prepare(): void {
    mkdirSync(CODEX_HOME, { recursive: true, mode: 0o700 })
  },
}
