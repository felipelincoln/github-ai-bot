import { useEffect, useState } from 'react'
import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { type Manifest, getManifest } from '@/lib/api'

export function AppPanel() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getManifest()
      .then(setManifest)
      .catch((e) => setError((e as Error).message))
  }, [])

  function create() {
    if (!manifest) return
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = manifest.postUrl
    form.target = '_blank'
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = 'manifest'
    input.value = JSON.stringify(manifest.manifest)
    form.appendChild(input)
    document.body.appendChild(form)
    form.submit()
    form.remove()
  }

  return (
    <div className="space-y-2">
      <Button onClick={create} disabled={!manifest} size="sm" className="w-fit">
        Create bot on GitHub <ArrowSquareOutIcon />
      </Button>
      {error && <p className="text-xs text-destructive">Couldn't load the setup link: {error}</p>}
    </div>
  )
}
