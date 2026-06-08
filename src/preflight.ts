import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const TTL_MS = 30_000

let cache: { ok: boolean; at: number } | null = null

// The bot acts on GitHub by shelling out to `gh` (with a short-lived token injected
// as GH_TOKEN). If `gh` isn't on PATH, every run fails — so we surface it as a health
// signal and re-check on the poll, like the other integrations.
export async function ghAvailable(): Promise<boolean> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ok
  let ok = false
  try {
    await execFileAsync('gh', ['--version'], { timeout: 5_000 })
    ok = true
  } catch {}
  cache = { ok, at: Date.now() }
  return ok
}
