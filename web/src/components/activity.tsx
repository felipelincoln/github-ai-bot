import { useEffect, useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { type DayActivity, getActivity } from '@/lib/api'
import { fmtTokens } from '@/lib/format'

const WEEKS = 53
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CELL = 11
const LEVELS = ['bg-muted', 'bg-brand/30', 'bg-brand/50', 'bg-brand/75', 'bg-brand']

const level = (tokens: number, max: number) => {
  if (tokens === 0 || max === 0) return 0
  const r = tokens / max
  return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4
}
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Cell {
  key: string
  date: Date
  count: number
  tokens: number
}

export function Activity() {
  const [days, setDays] = useState<DayActivity[] | null>(null)

  useEffect(() => {
    let alive = true
    const tick = () => {
      void getActivity()
        .then((r) => alive && setDays(r.days))
        .catch(() => {})
    }
    tick()
    const timer = setInterval(tick, 5_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  if (!days) return null

  const total = days.reduce((s, d) => s + d.count, 0)
  const ok = days.reduce((s, d) => s + d.ok, 0)
  const failed = days.reduce((s, d) => s + (d.failed ?? 0), 0)
  const finished = ok + failed
  const tokens = days.reduce((s, d) => s + d.tokens, 0)
  const successRate = finished ? Math.floor((ok / finished) * 100) : 0
  const byDay = new Map(days.map((d) => [d.day, d]))

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(today)
  start.setDate(start.getDate() - (WEEKS * 7 - 1))
  start.setDate(start.getDate() - start.getDay())

  const cells: Cell[] = []
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const row = byDay.get(dayKey(d))
    cells.push({ key: dayKey(d), date: new Date(d), count: row?.count ?? 0, tokens: row?.tokens ?? 0 })
  }
  const maxTokens = cells.reduce((m, c) => Math.max(m, c.tokens), 0)

  const columns: Cell[][] = []
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7))
  const cols = columns.length
  let lastMonth = cols ? columns[0][0].date.getMonth() : -1
  const months = columns.map((col) => {
    const m = col[0].date.getMonth()
    if (m === lastMonth) return ''
    lastMonth = m
    return MONTHS[m]
  })
  const gridCols = { gridTemplateColumns: `repeat(${cols}, minmax(${CELL}px, 1fr))` }

  return (
    <div className="mb-8 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-normal tracking-tight">Token activity</h2>
        {total > 0 ? (
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground">{total}</span> runs
            {finished > 0 && (
              <>
                {' · '}
                <span className="text-foreground">{successRate}%</span> ok
              </>
            )}
            {' · '}
            <span className="text-foreground" title={`${tokens.toLocaleString()} tokens`}>
              {fmtTokens(tokens)}
            </span>{' '}
            tokens
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No runs yet</p>
        )}
      </div>
      <div className="overflow-x-auto pb-1">
        <TooltipProvider delayDuration={300}>
          <div
            role="img"
            aria-label={`Token activity over the last year: ${fmtTokens(tokens)} tokens across ${total} runs, ${successRate}% successful`}
            className="grid w-full gap-0.5"
            style={{ ...gridCols, gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoFlow: 'column' }}
          >
            {cells.map((c) => (
              <Tooltip key={c.key}>
                <TooltipTrigger asChild>
                  <div className={`rounded-[2px] ${LEVELS[level(c.tokens, maxTokens)]}`} />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="font-normal">{fmtDay(c.date)}</div>
                  <div>
                    {c.count === 0
                      ? 'No runs'
                      : `${c.count} run${c.count === 1 ? '' : 's'} · ${fmtTokens(c.tokens)} tokens`}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        <div className="mt-1.5 grid w-full gap-0.5 overflow-hidden text-xs text-muted-foreground" style={gridCols}>
          {months.map((m, i) => (
            <div
              key={columns[i][0].key}
              className={`flex whitespace-nowrap ${i === months.length - 1 ? 'justify-end' : ''}`}
            >
              {m}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
