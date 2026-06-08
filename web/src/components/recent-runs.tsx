import { type ReactNode, useEffect, useState } from 'react'
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  ClockIcon,
  CopyIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { TriggerIcon } from '@/components/trigger-icon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ListRow } from '@/components/ui/list-row'
import { Separator } from '@/components/ui/separator'
import { type Queued, type Run, getRuns } from '@/lib/api'
import { fmtTokens, relativeTime } from '@/lib/format'

const STATUS_LABEL: Record<Run['status'], string> = { running: 'running', ok: 'succeeded', failed: 'failed' }

function RunIcon({ status, className = 'size-4' }: { status: Run['status']; className?: string }) {
  if (status === 'running')
    return (
      <CircleNotchIcon aria-label="running" className={`${className} shrink-0 animate-spin text-muted-foreground`} />
    )
  if (status === 'failed') return <XCircleIcon weight="fill" className={`${className} shrink-0 text-destructive`} />
  return <CheckCircleIcon weight="fill" className={`${className} shrink-0 text-muted-foreground`} />
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

function DetailSection({
  title,
  copyText,
  children,
}: {
  title: string
  copyText?: string | null
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs">{title}</span>
        {copyText ? <CopyButton text={copyText} /> : null}
      </div>
      {children}
    </div>
  )
}

function RunDetail({ run, onClose }: { run: Run; onClose: () => void }) {
  const failed = run.status === 'failed'
  const repo = `${run.repo_full_name ?? ''}#${run.number}`
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex min-w-0 items-center gap-2 pr-6">
            <RunIcon status={run.status} className="size-4" />
            <span className="truncate">{run.name ?? run.automation_id}</span>
          </DialogTitle>
          <DialogDescription>
            {STATUS_LABEL[run.status]} ·{' '}
            <span title={new Date(run.started_at).toLocaleString()}>{relativeTime(run.started_at)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Target</dt>
            <dd className="min-w-0">
              {run.url ? (
                <a
                  href={run.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-foreground hover:underline"
                >
                  {repo} <ArrowSquareOutIcon className="size-3.5" />
                </a>
              ) : (
                <span className="font-mono text-foreground">{repo}</span>
              )}
            </dd>

            <dt className="text-muted-foreground">Trigger</dt>
            <dd className="flex items-center gap-1.5 text-foreground">
              <TriggerIcon event={run.type ?? ''} className="size-3.5 shrink-0 text-muted-foreground" />
              {run.action ?? '—'}
            </dd>

            <dt className="text-muted-foreground">Effort</dt>
            <dd className="text-foreground">{run.effort ?? 'default'}</dd>

            <dt className="text-muted-foreground">Tokens</dt>
            <dd className="tabular-nums text-foreground">
              {run.tokens != null ? fmtTokens(run.tokens) : <span className="text-muted-foreground">—</span>}
            </dd>
          </dl>

          <DetailSection title={failed ? 'Error' : 'Result'} copyText={run.result}>
            {run.result ? (
              <pre
                className={`max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-xs ${failed ? 'text-destructive' : ''}`}
              >
                {run.result}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                {run.status === 'running' ? 'Waiting for result…' : 'No output.'}
              </p>
            )}
          </DetailSection>

          {run.resume_command && (
            <DetailSection title="Resume session" copyText={run.resume_command}>
              <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
                {run.resume_command}
              </pre>
            </DetailSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const ENTER = 'animate-in fade-in slide-in-from-top-1 duration-300'

type RunItem = { kind: 'run'; key: string; time: string; run: Run }
type QueuedItem = { kind: 'queued'; key: string; time: string; name: string; repo: string | null; number: number }
type Item = RunItem | QueuedItem

export function RecentRuns() {
  const [runs, setRuns] = useState<Run[]>([])
  const [queued, setQueued] = useState<Queued[]>([])
  const [selected, setSelected] = useState<Run | null>(null)
  const [limit, setLimit] = useState(50)

  useEffect(() => {
    let alive = true
    const tick = () => {
      void getRuns(limit)
        .then((r) => {
          if (!alive) return
          setRuns(r.runs)
          setQueued(r.queued)
        })
        .catch(() => {})
    }
    tick()
    const timer = setInterval(tick, 5000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [limit])

  if (runs.length === 0 && queued.length === 0) return null

  const detail = selected ? (runs.find((r) => r.id === selected.id) ?? selected) : null
  const canLoadMore = runs.length >= limit && limit < 100

  const items: Item[] = [
    ...queued.map(
      (q): QueuedItem => ({
        kind: 'queued',
        key: `q-${q.automation_id}-${q.repository_id}-${q.number}`,
        time: q.last_event_at,
        name: q.name ?? q.automation_id,
        repo: q.repo_full_name,
        number: q.number,
      }),
    ),
    ...runs.map((r): RunItem => ({ kind: 'run', key: `r-${r.id}`, time: r.started_at, run: r })),
  ]
  const rank = (it: Item) => (it.kind === 'queued' ? 0 : it.run.status === 'running' ? 1 : 2)
  items.sort(
    (a, b) => rank(a) - rank(b) || (a.time < b.time ? 1 : a.time > b.time ? -1 : 0) || a.key.localeCompare(b.key),
  )

  return (
    <>
      <div className="mt-8 flex flex-col gap-2">
        <h2 className="text-base font-normal tracking-tight">Recent runs</h2>
        <Separator />
        <div className="-mx-2 flex flex-col">
          {items.map((it) =>
            it.kind === 'queued' ? (
              <div key={it.key} className="flex animate-pulse items-center gap-2.5 rounded-md px-2 py-2">
                <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="max-w-56 shrink-0 truncate text-sm">{it.name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                  {`${it.repo ?? ''}#${it.number}`}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">Queued</span>
              </div>
            ) : (
              <ListRow
                key={it.key}
                onClick={() => setSelected(it.run)}
                className={it.run.status === 'running' ? 'animate-pulse' : ENTER}
              >
                <RunIcon status={it.run.status} />
                <span
                  className={`max-w-56 shrink-0 truncate text-sm ${it.run.status === 'failed' ? 'text-destructive' : ''}`}
                >
                  {it.run.name ?? it.run.automation_id}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-xs ${it.run.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  <span className="font-mono">{`${it.run.repo_full_name ?? ''}#${it.run.number}`}</span>
                  {it.run.action ? ` · ${it.run.action}` : ''}
                  {it.run.status === 'failed' && it.run.result ? ` — ${it.run.result}` : ''}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {relativeTime(it.run.started_at)}
                </span>
              </ListRow>
            ),
          )}
        </div>
        {canLoadMore && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 self-center text-xs text-muted-foreground"
            onClick={() => setLimit((l) => Math.min(l + 50, 100))}
          >
            Load more
          </Button>
        )}
      </div>

      {detail && <RunDetail run={detail} onClose={() => setSelected(null)} />}
    </>
  )
}
