import { chmodSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { log } from './log.js'

const CONFIG_DIR =
  process.env.GITHUB_AI_BOT_CONFIG_DIR ??
  join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'github-ai-bot')

export const paths = {
  dir: CONFIG_DIR,
  config: join(CONFIG_DIR, 'config.json'),
  automations: join(CONFIG_DIR, 'automations.json'),
  pem: join(CONFIG_DIR, 'private-key.pem'),
  db: join(CONFIG_DIR, 'github-ai-bot.db'),
} as const

export interface GithubApp {
  appId: string
  slug: string
  webhookSecret: string
}

export interface Config {
  onboardedAt?: string
  engine?: string
  workers?: number
  github?: GithubApp
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  chmodSync(dir, 0o700)
}

export function ensureConfigDir(): void {
  ensureDir(CONFIG_DIR)
}

function quarantineCorrupt(file: string): void {
  try {
    renameSync(file, `${file}.corrupt`)
    log('storage', `corrupt file reset: ${file} (renamed to ${file}.corrupt)`)
  } catch {}
}

export function readJsonFile<T>(file: string, fallback: T): T {
  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    quarantineCorrupt(file)
    return fallback
  }
}

function writeFileAtomic(file: string, data: string, mode: number): void {
  ensureDir(dirname(file))
  const tmp = `${file}.${process.pid}.tmp`
  try {
    writeFileSync(tmp, data, { mode })
    chmodSync(tmp, mode)
    renameSync(tmp, file)
  } catch (err) {
    try {
      unlinkSync(tmp)
    } catch {}
    throw err
  }
}

export function writeJsonFileAtomic(file: string, value: unknown, mode = 0o600): void {
  writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`, mode)
}

export function loadConfig(): Config {
  return readJsonFile<Config>(paths.config, {})
}

export function saveConfig(config: Config): void {
  writeJsonFileAtomic(paths.config, config)
}

export function isOnboarded(config: Config = loadConfig()): boolean {
  return typeof config.onboardedAt === 'string'
}

export function markOnboarded(): Config {
  const config = loadConfig()
  if (config.onboardedAt) return config
  config.onboardedAt = new Date().toISOString()
  saveConfig(config)
  return config
}

export function readPem(): string | null {
  try {
    return readFileSync(paths.pem, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export function writePem(pem: string): void {
  writeFileAtomic(paths.pem, pem, 0o600)
}
