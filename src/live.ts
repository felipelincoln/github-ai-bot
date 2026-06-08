import { setTimeout as sleep } from 'node:timers/promises'
import { ensureCloudflared } from './cloudflared.js'
import { loadConfig } from './config.js'
import { codexRuntime } from './runtime.codex.js'
import { patchAppWebhook } from './github.js'
import { log } from './log.js'
import { startWorkerPool, stopWorkerPool } from './pool.js'
import { type Tunnel, killTunnels, startTunnel } from './tunnel.js'
import { type WebhookServer, startWebhookServer } from './webhook.js'

export type WebhookStatus = 'off' | 'starting' | 'live' | 'retrying' | 'failed'

let server: WebhookServer | null = null
let tunnel: Tunnel | null = null
let currentSecret: string | null = null
let epoch = 0
let stopped = false
let status: WebhookStatus = 'off'
let publicUrl: string | null = null
let detail: string | null = null

export function webhookState(): { status: WebhookStatus; url: string | null; detail: string | null } {
  return { status, url: publicUrl, detail }
}

async function reconnect(myEpoch: number, secret: string, localUrl: string): Promise<void> {
  for (let attempt = 0; epoch === myEpoch && !stopped && attempt < 9; attempt++) {
    status = attempt === 0 ? 'starting' : 'retrying'
    tunnel?.close()
    tunnel = null
    try {
      const bin = await ensureCloudflared()
      const next = await startTunnel(bin, localUrl)
      if (epoch !== myEpoch || stopped) {
        next.close()
        return
      }
      try {
        await patchAppWebhook(`${next.url}/webhook`, secret)
      } catch (err) {
        next.close()
        throw err
      }
      if (epoch !== myEpoch || stopped) {
        next.close()
        return
      }
      tunnel = next
      publicUrl = `${next.url}/webhook`
      status = 'live'
      detail = null
      log('webhook', `live at ${publicUrl}`)
      void next.exited.then(() => {
        if (stopped || epoch !== myEpoch || tunnel !== next) return
        log('tunnel', 'exited — reconnecting')
        void reconnect(myEpoch, secret, localUrl)
      })
      return
    } catch (err) {
      detail = (err as Error).message
      log('webhook', `setup failed: ${detail}`)
      if (epoch === myEpoch && !stopped) {
        status = 'retrying'
        await sleep(Math.min(2000 * 2 ** attempt, 30_000))
      }
    }
  }
  if (epoch === myEpoch && !stopped) {
    status = 'failed'
    log('tunnel', `unavailable — retry the webhook from the dashboard${detail ? ` (${detail})` : ''}`)
  }
}

async function teardown(): Promise<void> {
  epoch++
  status = 'off'
  publicUrl = null
  detail = null
  tunnel = null
  killTunnels()
  await server?.close()
  server = null
}

async function ensureLiveOnce(force: boolean): Promise<void> {
  if (stopped) return
  const config = loadConfig()
  if (!config.github) return
  const secret = config.github.webhookSecret
  if (!force && server && secret === currentSecret && status !== 'failed') return
  await teardown()
  const myEpoch = epoch
  currentSecret = secret
  status = 'starting'
  server = await startWebhookServer(secret)
  void reconnect(myEpoch, secret, `http://127.0.0.1:${server.port}`)
}

let ensureChain: Promise<void> = Promise.resolve()

function ensureLive(force = false): Promise<void> {
  ensureChain = ensureChain.then(
    () => ensureLiveOnce(force),
    () => ensureLiveOnce(force),
  )
  return ensureChain
}

export async function startIngestion(): Promise<() => Promise<void>> {
  stopped = false
  await ensureLive()
  startWorkerPool(codexRuntime())
  return async () => {
    stopped = true
    await ensureChain.catch(() => {})
    await stopWorkerPool()
    await teardown()
  }
}

export function notifyAppConfigured(): void {
  void ensureLive()
}

export function retryWebhook(): void {
  void ensureLive(true)
}
