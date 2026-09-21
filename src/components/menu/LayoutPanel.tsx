import { useRef, useState } from 'react'
import { Panel } from './Panel'
import { Segmented, SectionTitle, Slider, Toggle } from '../ui/controls'
import { deleteBlob, putBlob } from '@/lib/blobStore'
import {
  DEFAULT_WORKSPACE,
  GRID_LIMITS,
  STORED_GIF,
  type LayoutMode,
} from '@/lib/workspace'
import { useSettings } from '@/store/settings'

export function LayoutPanel() {
  const workspace = useSettings((s) => s.workspace)
  const setWorkspace = useSettings((s) => s.setWorkspace)
  const resizeGrid = useSettings((s) => s.resizeGrid)

  return (
    <Panel title="Layout" wide>
      <Segmented<LayoutMode>
        value={workspace.mode}
        onChange={(mode) => setWorkspace('mode', mode)}
        options={[
          { value: 'free', label: 'Free' },
          { value: 'bento', label: 'Bento' },
        ]}
      />

      <p className="px-1 text-[10px] leading-relaxed text-white/45">
        {workspace.mode === 'free'
          ? 'Drag the clock, player, lyrics and GIF anywhere. Hover one for a reset button.'
          : 'Drag a box to move it between cells, or pull its bottom-right corner to resize. A move onto occupied cells snaps back.'}
      </p>

      {workspace.mode === 'free' && (
        <>
          <SectionTitle>Snapping</SectionTitle>
          <Toggle
            label={workspace.snap ? 'Snap on' : 'Snap off'}
            active={workspace.snap}
            onClick={() => setWorkspace('snap', !workspace.snap)}
          />
          {workspace.snap && (
            <>
              <Slider
                label="Grid"
                min={0}
                max={96}
                step={4}
                value={workspace.snapStep}
                format={(v) => (v === 0 ? 'guides only' : `${v}px`)}
                onChange={(v) => setWorkspace('snapStep', v)}
              />
              <p className="px-1 text-[10px] leading-relaxed text-white/40">
                Widgets line up with the screen centre and with each other; a guide
                shows when one catches.
              </p>
            </>
          )}
        </>
      )}

      {workspace.mode === 'bento' && (
        <>
          <SectionTitle>Grid</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Slider
              label="Columns"
              min={GRID_LIMITS.columns[0]}
              max={GRID_LIMITS.columns[1]}
              value={workspace.columns}
              onChange={(v) => resizeGrid(v, workspace.rows)}
            />
            <Slider
              label="Rows"
              min={GRID_LIMITS.rows[0]}
              max={GRID_LIMITS.rows[1]}
              value={workspace.rows}
              onChange={(v) => resizeGrid(workspace.columns, v)}
            />
            <Slider
              label="Gap"
              min={0}
              max={48}
              value={workspace.gap}
              format={(v) => `${v}px`}
              onChange={(v) => setWorkspace('gap', v)}
            />
            <Slider
              label="Margin"
              min={0}
              max={96}
              value={workspace.padding}
              format={(v) => `${v}px`}
              onChange={(v) => setWorkspace('padding', v)}
            />
          </div>
          <Toggle
            label="Show boxes"
            active={workspace.boxes}
            onClick={() => setWorkspace('boxes', !workspace.boxes)}
          />
        </>
      )}

      <GifSection />

      <button
        type="button"
        onClick={() => setWorkspace('placements', DEFAULT_WORKSPACE.placements)}
        className="self-start px-1 py-1 text-[10px] text-white/50 hover:text-white"
      >
        Reset all positions
      </button>
    </Panel>
  )
}

const MAX_UPLOAD = 25 * 1024 * 1024

function GifSection() {
  const gif = useSettings((s) => s.workspace.gif)
  const setGif = useSettings((s) => s.setGif)
  const file = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const useUrl = () => {
    const value = url.trim()
    if (!/^(https?:|data:image\/)/i.test(value)) {
      setStatus('That needs to be an http(s) link or a data:image URL.')
      return
    }
    void deleteBlob('gif')
    setGif('source', value)
    setGif('visible', true)
    setStatus('Loaded from link.')
  }

  const upload = async (chosen: File) => {
    if (chosen.size > MAX_UPLOAD) {
      setStatus('That file is over 25MB — link to it instead.')
      return
    }
    try {
      await putBlob('gif', chosen)
      setGif('source', STORED_GIF)
      setGif('visible', true)
      setStatus(`${chosen.name} loaded.`)
    } catch {
      setStatus('Could not store that file in this browser.')
    }
  }

  const clear = () => {
    void deleteBlob('gif')
    setGif('source', null)
    setGif('visible', false)
    setUrl('')
    setStatus(null)
  }

  return (
    <>
      <SectionTitle>GIF</SectionTitle>

      {gif.source ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Toggle
              label={gif.visible ? 'Shown' : 'Hidden'}
              active={gif.visible}
              onClick={() => setGif('visible', !gif.visible)}
            />
            <Toggle
              label={gif.fit === 'cover' ? 'Fill box' : 'Fit inside'}
              active={gif.fit === 'cover'}
              onClick={() => setGif('fit', gif.fit === 'cover' ? 'contain' : 'cover')}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate px-1 text-[10px] text-white/45">
              {gif.source === STORED_GIF ? 'Uploaded file' : gif.source}
            </span>
            <button
              type="button"
              onClick={clear}
              className="shrink-0 px-1 py-1 text-[10px] text-white/50 hover:text-white"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a GIF link"
              spellCheck={false}
              className="h-9 min-w-0 flex-1 rounded-lg bg-white/10 px-3 text-[11px] text-white placeholder:text-white/40 focus:outline-none"
            />
            <Toggle label="Use" active={false} disabled={!url.trim()} onClick={useUrl} />
          </div>
          <Toggle label="Or upload a file" active={false} onClick={() => file.current?.click()} />
          <input
            ref={file}
            type="file"
            accept="image/gif,image/webp,image/apng,image/png,image/jpeg,video/mp4"
            className="hidden"
            onChange={(e) => {
              const chosen = e.target.files?.[0]
              if (chosen) void upload(chosen)
              e.target.value = ''
            }}
          />
          <p className="px-1 text-[10px] leading-relaxed text-white/40">
            Uploads are kept in this browser&apos;s IndexedDB, so they survive a reload
            without eating the settings storage budget.
          </p>
        </>
      )}

      {status && <p className="px-1 text-[10px] text-white/55">{status}</p>}
    </>
  )
}
