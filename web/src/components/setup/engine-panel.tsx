import { useCallback, useEffect, useState } from 'react'
import { CheckIcon, CircleNotchIcon, CopyIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { type EngineMeta, getEngines, recheckEngine, setEngine } from '@/lib/api'

export function EnginePanel({ engine, onAdvance }: { engine: string | null; onAdvance: () => void }) {
  const [engines, setEngines] = useState<EngineMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setError(null)
    void getEngines()
      .then((r) => setEngines(r.engines))
      .catch((e) => setError((e as Error).message))
  }, [])
  useEffect(() => load(), [load])
  if (error)
    return (
      <div className="space-y-2">
        <p className="text-xs text-destructive">Couldn't load engines: {error}</p>
        <Button size="sm" variant="outline" onClick={load}>
          Retry
        </Button>
      </div>
    )
  if (!engines) return null
  const chosen = engine ? engines.find((e) => e.id === engine) : undefined
  return chosen ? <Connect meta={chosen} onAdvance={onAdvance} /> : <Picker engines={engines} onAdvance={onAdvance} />
}

function Picker({ engines, onAdvance }: { engines: EngineMeta[]; onAdvance: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pick = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await setEngine(id)
      onAdvance()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      {engines.map((e) => (
        <Button
          key={e.id}
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void pick(e.id)}
          className="w-full justify-between"
        >
          {e.label}
          {e.recommended && <span className="text-xs text-muted-foreground">Recommended</span>}
        </Button>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function Connect({ meta, onAdvance }: { meta: EngineMeta; onAdvance: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verify = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await recheckEngine()
      if (r.configured) onAdvance()
      else setError('Login not detected yet — run the command above, then try again.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (meta.auth.mode !== 'login-command' || !meta.auth.command) {
    return <p className="text-sm text-muted-foreground">This engine is not supported in this build yet.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Run this in your terminal, then come back:</p>
      <CopyCommand command={meta.auth.command} />
      <div className="flex items-center gap-3">
        <Button onClick={() => void verify()} disabled={busy} size="sm">
          {busy ? (
            <>
              <CircleNotchIcon className="animate-spin" /> Checking…
            </>
          ) : (
            "I've logged in"
          )}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted p-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs">{command}</code>
      <Button type="button" variant="ghost" size="icon-xs" onClick={copy} aria-label="Copy command">
        {copied ? <CheckIcon className="text-foreground" /> : <CopyIcon />}
      </Button>
    </div>
  )
}
