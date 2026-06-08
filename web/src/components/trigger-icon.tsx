import { CircleDashedIcon, GitPullRequestIcon } from '@phosphor-icons/react'

export function TriggerIcon({
  event,
  className = 'size-4 shrink-0 text-muted-foreground',
}: {
  event: string
  className?: string
}) {
  const Icon = event.startsWith('pull_request') ? GitPullRequestIcon : CircleDashedIcon
  return <Icon className={className} />
}
