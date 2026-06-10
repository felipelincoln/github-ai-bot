import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { test } from 'node:test'

const { processMatches, reapOrphan } = await import('../dist/reap.js')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
async function waitDead(pid, ms = 2000) {
  const t = Date.now()
  while (Date.now() - t < ms) {
    if (!alive(pid)) return true
    await wait(50)
  }
  return !alive(pid)
}
const fake = (marker) => spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 60000)', marker], { stdio: 'ignore' })

test('processMatches: live process whose command contains the needle', async () => {
  const p = fake('codex-marker')
  await wait(150)
  assert.equal(processMatches(p.pid, 'codex-marker'), true)
  assert.equal(processMatches(p.pid, 'nope-needle'), false, 'command must match the needle')
  p.kill('SIGKILL')
  await waitDead(p.pid)
  assert.equal(processMatches(p.pid, 'codex-marker'), false, 'dead pid no longer matches')
})

test('processMatches refuses pid <= 0 (never addresses a process group)', () => {
  assert.equal(processMatches(0, 'x'), false)
  assert.equal(processMatches(-1, 'x'), false)
  assert.equal(processMatches(1.5, 'x'), false)
})

test('reapOrphan kills a matching live process but spares a non-matching one', async () => {
  const target = fake('codex-marker')
  await wait(150)
  assert.equal(reapOrphan(target.pid, 'codex-marker'), true)
  assert.ok(await waitDead(target.pid), 'matching process was killed')

  const innocent = fake('innocent-marker')
  await wait(150)
  assert.equal(reapOrphan(innocent.pid, 'codex-marker'), false, 'needle mismatch -> not killed')
  assert.ok(alive(innocent.pid), 'innocent process survives')
  innocent.kill('SIGKILL')
})
