import { useCallback, useEffect, useRef, useState } from 'react'
import { type DomainId, type State, getState } from './api'

const CORE: DomainId[] = ['app', 'repos', 'engine']

export function useSetupState(): { state: State | null; refresh: () => Promise<void> } {
  const [state, setState] = useState<State | null>(null)
  const seq = useRef(0)

  const refresh = useCallback(async () => {
    const gen = ++seq.current
    try {
      const next = await getState()
      if (gen === seq.current) setState(next)
    } catch {}
  }, [])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      const gen = ++seq.current
      let next: State | null = null
      try {
        next = await getState()
      } catch {}
      if (!alive) return
      if (next && gen === seq.current) setState(next)
      const healthy = next != null && CORE.every((id) => next.domains[id].done)
      timer = setTimeout(tick, healthy ? 5000 : 1500)
    }
    void tick()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  return { state, refresh }
}
