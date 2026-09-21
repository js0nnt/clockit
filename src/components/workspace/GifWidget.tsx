import { useGifUrl } from '@/lib/gif'
import { useSettings } from '@/store/settings'

export function GifWidget({ fill }: { fill?: boolean }) {
  const fit = useSettings((s) => s.workspace.gif.fit)
  const url = useGifUrl()

  if (!url) return null

  return (
    <div
      className={`overflow-hidden rounded-2xl ${
        fill ? 'h-full w-full' : 'h-[180px] w-[240px]'
      } ${fit === 'contain' ? 'glass-panel' : ''}`}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        className="h-full w-full select-none"
        style={{ objectFit: fit }}
      />
    </div>
  )
}
