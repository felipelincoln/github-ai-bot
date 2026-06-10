import { loadConfig } from './config.js'
import { deliveryExists, ingestDelivery } from './deliveries.js'
import { SUPPORTED_EVENTS, extract } from './extract.js'
import { getDeliveryPayload, listDeliveriesSince } from './github.js'
import { log } from './log.js'
import { wakeWorkers } from './pool.js'

const LOOKBACK_MS = 24 * 60 * 60_000

// On start, GitHub may have fired webhooks while the bot was down or the tunnel
// was pointing at a dead URL — those are lost, since GitHub never retries on its
// own. Pull the last 24h from the App delivery log and re-ingest the ones we
// never recorded. Dedup is by delivery guid, so anything we already have (or new
// events arriving live) is skipped; ingestion enqueues jobs the same as a live
// webhook, healing the gap as delayed delivery rather than permanent loss.
export async function backfillDeliveries(): Promise<void> {
  const slug = loadConfig().github?.slug
  if (!slug) {
    log('backfill', 'skipped — app not configured')
    return
  }

  const since = new Date(Date.now() - LOOKBACK_MS).toISOString()
  let deliveries: Awaited<ReturnType<typeof listDeliveriesSince>>
  try {
    deliveries = await listDeliveriesSince(since)
  } catch (err) {
    log('backfill', `could not list deliveries: ${(err as Error).message}`)
    return
  }

  let ingested = 0
  let matched = 0
  for (const d of deliveries) {
    // Cheap pre-filters before spending a GET on the full payload.
    if (!SUPPORTED_EVENTS.has(d.event)) continue
    if (deliveryExists(d.guid)) continue

    let payload: Record<string, unknown> | null
    try {
      payload = await getDeliveryPayload(d.id)
    } catch (err) {
      log('backfill', `skip ${d.guid}: ${(err as Error).message}`)
      continue
    }
    if (!payload) continue

    const extracted = extract(d.event, payload)
    if (!extracted) continue

    // Don't recover the bot's own events, mirroring the live webhook path.
    const sender = (payload.sender as { login?: unknown } | undefined)?.login
    if (typeof sender === 'string' && sender === `${slug}[bot]`) continue

    try {
      const result = ingestDelivery(d.guid, extracted, d.delivered_at)
      if (result.inserted) ingested++
      if (result.matched > 0) matched++
    } catch (err) {
      log('backfill', `ingest ${d.guid} failed: ${(err as Error).message}`)
    }
  }

  if (ingested > 0) wakeWorkers()
  // Always log on startup — a "recovered 0" line confirms the scan ran and the
  // gap was clean, which is exactly the signal you want when all is well.
  log('backfill', `scanned ${deliveries.length} deliveries (24h); recovered ${ingested}, matched ${matched}`)
}
