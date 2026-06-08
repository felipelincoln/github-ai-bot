import { useEffect, useState } from 'react'
import { ArrowSquareOutIcon, QuestionIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type Manifest, getManifest } from '@/lib/api'

export function AppPanel() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    setManifest(null)
    setError(null)
    void getManifest(isPublic)
      .then(setManifest)
      .catch((e) => setError((e as Error).message))
  }, [isPublic])

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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Switch id="public-app" checked={isPublic} onCheckedChange={setIsPublic} aria-label="Public app" />
        <label htmlFor="public-app" className="text-sm">
          Public app
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="What does public mean?"
              className="text-muted-foreground hover:text-foreground"
            >
              <QuestionIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Private (default): the App installs only on your account — the bot acts on your repos.</p>
            <p className="mt-1">
              Public: any account or organization can install it, so the bot acts on their repos too.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Button onClick={create} disabled={!manifest} size="sm" className="w-fit">
        Create bot on GitHub <ArrowSquareOutIcon />
      </Button>
      {error && <p className="text-xs text-destructive">Couldn't load the setup link: {error}</p>}
    </div>
  )
}
