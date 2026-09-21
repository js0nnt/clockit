import { useCallback, useState, type ReactNode } from 'react'
import {
  AudioLines,
  Clock,
  Expand,
  LayoutGrid,
  Layers,
  Moon,
  Shrink,
  Sparkles,
  Type,
  Zap,
} from 'lucide-react'
import { ClockPanel } from './ClockPanel'
import { FontPanel } from './FontPanel'
import { FlapsPanel } from './FlapsPanel'
import { AnimationPanel } from './AnimationPanel'
import { ColorPanel } from './ColorPanel'
import { BackdropPanel } from './BackdropPanel'
import { LayoutPanel } from './LayoutPanel'
import { SpotifyPanel } from '@/features/spotify/SpotifyPanel'
import { useDismiss, useFullscreen, usePointerActive } from '@/lib/hooks'

type PanelId =
  | 'clock'
  | 'font'
  | 'flaps'
  | 'animation'
  | 'color'
  | 'backdrop'
  | 'spotify'
  | 'layout'

const ITEMS: { id: PanelId; title: string; icon: ReactNode; panel: ReactNode }[] = [
  { id: 'clock', title: 'Clock Type', icon: <Clock />, panel: <ClockPanel /> },
  { id: 'font', title: 'Font Style', icon: <Type />, panel: <FontPanel /> },
  { id: 'flaps', title: 'Tile Size', icon: <Layers />, panel: <FlapsPanel /> },
  { id: 'animation', title: 'Animation & Sounds', icon: <Zap />, panel: <AnimationPanel /> },
  { id: 'color', title: 'Colors & Themes', icon: <Moon />, panel: <ColorPanel /> },
  { id: 'backdrop', title: 'Backdrop', icon: <Sparkles />, panel: <BackdropPanel /> },
  { id: 'spotify', title: 'Spotify', icon: <AudioLines />, panel: <SpotifyPanel /> },
  { id: 'layout', title: 'Layout', icon: <LayoutGrid />, panel: <LayoutPanel /> },
]

export function CircularMenu() {
  const [open, setOpen] = useState<PanelId | null>(null)
  const pointerActive = usePointerActive()
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  const close = useCallback(() => setOpen(null), [])
  const containerRef = useDismiss(close, open !== null)

  const visible = pointerActive || open !== null
  const active = ITEMS.find((i) => i.id === open)

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-7 left-6 z-20 flex flex-col gap-3 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {active && <div className="origin-bottom-left">{active.panel}</div>}

      <div className="flex gap-2">
        {ITEMS.map((item, index) => (
          <MenuButton
            key={item.id}
            title={item.title}
            active={open === item.id}
            visible={visible}
            index={index}
            onClick={() => setOpen((cur) => (cur === item.id ? null : item.id))}
          >
            {item.icon}
          </MenuButton>
        ))}
        <MenuButton
          title={isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
          active={false}
          visible={visible}
          index={ITEMS.length}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Shrink /> : <Expand />}
        </MenuButton>
      </div>
    </div>
  )
}

function MenuButton({
  title,
  active,
  visible,
  index,
  onClick,
  children,
}: {
  title: string
  active: boolean
  visible: boolean
  index: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{ transitionDelay: `${visible ? index * 35 : 0}ms` }}
      className={`glass-panel relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform duration-300 ease-out [&_svg]:h-5 [&_svg]:w-5 ${
        visible ? 'scale-100' : 'scale-0'
      } ${active ? 'text-black' : 'text-white'}`}
    >
      <span
        className={`absolute inset-0 rounded-full transition-opacity ${
          active ? 'bg-white/80 opacity-100' : 'opacity-0'
        }`}
      />
      <span className="relative flex items-center justify-center">{children}</span>
    </button>
  )
}
