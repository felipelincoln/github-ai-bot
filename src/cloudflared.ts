import { execFile } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, createReadStream, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { promisify } from 'node:util'
import { paths } from './config.js'
import { log } from './log.js'

const execFileAsync = promisify(execFile)

const VERSION = '2026.5.2'
const RELEASE_BASE = `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}`

interface Target {
  asset: string
  sha256: string
  archiveSha256?: string
}

const TARGETS: Record<string, Target> = {
  'darwin-arm64': {
    asset: 'cloudflared-darwin-arm64.tgz',
    sha256: 'cd9f764abfd06757b4def10ee5ba3d862381ed9fc02d6c1f06086c23d88695c6',
    archiveSha256: 'ba94054c9fd4297645093d59d51442e5e546d07bb0516120e694a13d5b216d38',
  },
  'darwin-x64': {
    asset: 'cloudflared-darwin-amd64.tgz',
    sha256: 'c4fdc6021cd63003e32e70b577e17d47d493c6df4e24c7c97169ed74b67a715d',
    archiveSha256: '7240f709506bc2c1eb9da4d89cf2555499c60280ecb854b7d80e8f17d4b7903d',
  },
  'linux-arm64': {
    asset: 'cloudflared-linux-arm64',
    sha256: '5a4e8ce2701105271412059f44b6a0bf1ae4542b4d98ff3180c0c019443a5815',
  },
  'linux-x64': {
    asset: 'cloudflared-linux-amd64',
    sha256: '5286698547f03df745adb2355f04c12dde52ef425491e81f433642d695521886',
  },
}

const SUPPORTED = Object.keys(TARGETS).join(', ')
const BIN_DIR = join(paths.dir, 'bin')
const binPath = join(BIN_DIR, `cloudflared-${VERSION}`)

function target(): Target {
  const key = `${process.platform}-${process.arch}`
  const found = TARGETS[key]
  if (!found) throw new Error(`cloudflared: unsupported platform ${key} (supported: ${SUPPORTED})`)
  return found
}

function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(file)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function download(url: string, dest: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** attempt)
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: 'follow' })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
      return
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`cloudflared download failed: ${(lastError as Error).message}`)
}

async function acquire(): Promise<string> {
  const t = target()
  if (existsSync(binPath) && (await sha256File(binPath)) === t.sha256) return binPath
  mkdirSync(BIN_DIR, { recursive: true, mode: 0o700 })
  log('cloudflared', `downloading ${VERSION} (one-time)…`)
  const stamp = `${process.pid}-${randomBytes(4).toString('hex')}`
  const downloaded = join(BIN_DIR, `.dl-${stamp}`)
  const extractDir = join(BIN_DIR, `.x-${stamp}`)
  try {
    await download(`${RELEASE_BASE}/${t.asset}`, downloaded)
    let staged = downloaded
    if (t.archiveSha256) {
      if ((await sha256File(downloaded)) !== t.archiveSha256) {
        throw new Error('cloudflared: archive checksum mismatch, refusing to extract')
      }
      mkdirSync(extractDir, { recursive: true, mode: 0o700 })
      await execFileAsync('tar', ['-xzf', downloaded, '-C', extractDir])
      staged = join(extractDir, 'cloudflared')
    }
    if ((await sha256File(staged)) !== t.sha256) {
      throw new Error('cloudflared: checksum mismatch, refusing to run')
    }
    chmodSync(staged, 0o755)
    renameSync(staged, binPath)
    log('cloudflared', `downloaded ${VERSION}`)
    return binPath
  } finally {
    rmSync(downloaded, { force: true })
    rmSync(extractDir, { recursive: true, force: true })
  }
}

let inflight: Promise<string> | null = null

export function ensureCloudflared(): Promise<string> {
  if (inflight) return inflight
  const run = acquire()
  inflight = run
  void run.finally(() => {
    if (inflight === run) inflight = null
  })
  return run
}
