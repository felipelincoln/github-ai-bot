import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export function ReposPanel({ appSlug }: { appSlug: string | null }) {
  const installUrl = appSlug ? `https://github.com/apps/${appSlug}/installations/new` : null
  return (
    <Button
      onClick={() => installUrl && window.open(installUrl, '_blank')}
      disabled={!installUrl}
      size="sm"
      className="w-fit"
    >
      Choose repositories <ArrowSquareOutIcon />
    </Button>
  )
}
