import { loadConfig } from '../config.js'
import { codexEngine } from './codex.js'
import type { Engine, EngineMeta } from './types.js'

const ENGINES: Record<string, Engine> = {
  codex: codexEngine,
}

export function isEngineId(s: string | null | undefined): s is string {
  return typeof s === 'string' && s in ENGINES
}

export function activeEngine(): Engine {
  const id = loadConfig().engine
  if (!isEngineId(id)) {
    throw new Error(`unknown engine '${id ?? ''}' — set config.engine to one of: ${Object.keys(ENGINES).join(', ')}`)
  }
  return ENGINES[id]
}

function toMeta(e: Engine): EngineMeta {
  return {
    id: e.id,
    label: e.label,
    recommended: e.recommended,
    auth: {
      mode: e.auth.mode,
      command: e.auth.command ?? null,
      placeholder: e.auth.placeholder ?? null,
      tokenEnvVar: e.auth.tokenEnvVar ?? null,
    },
    warning: e.warning ?? null,
    models: e.models ?? [],
    efforts: e.efforts ?? [],
    configured: e.isConfigured(),
  }
}

export function engineMetas(): EngineMeta[] {
  return Object.values(ENGINES).map(toMeta)
}

export { ENGINES }
