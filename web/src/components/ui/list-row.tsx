import type * as React from 'react'
import { cn } from '@/lib/utils'

export function ListRow({ className, type = 'button', ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  )
}
