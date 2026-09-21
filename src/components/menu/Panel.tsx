import type { ReactNode } from 'react'

export function Panel({
  title,
  children,
  wide,
}: {
  title: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={`glass-panel scroll-thin max-h-[70vh] overflow-y-auto rounded-2xl p-3 ${
        wide ? 'w-[340px]' : 'w-[270px]'
      }`}
    >
      <h2 className="px-1 pb-2 text-xs font-semibold tracking-wide text-white">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}
