import { type ChildProcess, spawn } from 'node:child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { paths } from './config.js'
import { log } from './log.js'
import { reapOrphan } from './reap.js'

const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/
const READY_RE = /Registered tunnel connection|Connection [0-9a-f-]+ registered/i
const URL_TIMEOUT_MS = 20_000
const READY_TIMEOUT_MS = 30_000

export interface Tunnel {
  url: string
  close: () => void
  exited: Promise<number>
}

const liveProcs = new Set<ChildProcess>()

function clearTunnelPid(): void {
  try {
    unlinkSync(paths.tunnelPid)
  } catch {}
}

// cloudflared is spawned non-detached and tracked only in the in-memory set
// above, so a hard crash (no teardown) orphans it with no handle to clean it up
// on the next start. Persist the live PID and reap a leftover before we mint a
// new tunnel — the command check makes PID reuse unable to kill an innocent one.
export function reapOrphanTunnel(): void {
  let pid: number
  try {
    pid = Number(readFileSync(paths.tunnelPid, 'utf8').trim())
  } catch {
    return // no pidfile — clean shutdown left nothing behind
  }
  if (reapOrphan(pid, 'cloudflared')) log('tunnel', `reaped orphaned cloudflared (pid ${pid}) from a previous crash`)
  clearTunnelPid()
}

export function killTunnels(): void {
  for (const proc of liveProcs) proc.kill('SIGKILL')
  liveProcs.clear()
  clearTunnelPid()
}

export function startTunnel(bin: string, localUrl: string): Promise<Tunnel> {
  const proc = spawn(bin, ['tunnel', '--url', localUrl, '--no-autoupdate'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  liveProcs.add(proc)
  // Record durably so a crash leftover can be reaped on the next start. A
  // reconnect overwrites this with the new PID; killTunnels clears it.
  if (proc.pid !== undefined) {
    try {
      writeFileSync(paths.tunnelPid, String(proc.pid))
    } catch {}
  }
  proc.once('exit', () => liveProcs.delete(proc))
  const exited = new Promise<number>((resolve) => {
    proc.once('exit', (code) => resolve(code ?? 0))
    proc.once('error', () => resolve(-1))
  })

  return new Promise<Tunnel>((resolve, reject) => {
    let buf = ''
    let url = ''
    let settled = false
    let urlTimer: ReturnType<typeof setTimeout>
    let readyTimer: ReturnType<typeof setTimeout>

    function onData(chunk: Buffer): void {
      buf += chunk.toString('utf8')
      if (buf.length > 65_536) buf = buf.slice(-8192)
      if (!url) {
        const match = buf.match(URL_RE)
        if (match) {
          url = match[0]
          clearTimeout(urlTimer)
        }
      }
      if (url && READY_RE.test(buf)) finish(true)
    }

    const finish = (ok: boolean, message?: string): void => {
      if (settled) return
      settled = true
      clearTimeout(urlTimer)
      clearTimeout(readyTimer)
      proc.stderr?.off('data', onData)
      proc.stderr?.resume()
      if (ok) {
        resolve({ url, close: () => void proc.kill('SIGTERM'), exited })
      } else {
        proc.kill('SIGKILL')
        liveProcs.delete(proc)
        reject(new Error(message))
      }
    }

    proc.stderr?.on('data', onData)
    urlTimer = setTimeout(() => {
      if (!url) finish(false, 'cloudflared: timed out waiting for tunnel URL')
    }, URL_TIMEOUT_MS)
    readyTimer = setTimeout(
      () =>
        finish(
          false,
          url ? 'cloudflared: tunnel never registered with the edge' : 'cloudflared: timed out waiting for tunnel URL',
        ),
      READY_TIMEOUT_MS,
    )
    proc.once('exit', () => finish(false, 'cloudflared exited before the tunnel was ready'))
    proc.once('error', (err) => finish(false, `cloudflared: ${err.message}`))
  })
}
