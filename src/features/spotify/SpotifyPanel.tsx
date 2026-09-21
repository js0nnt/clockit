import { useState } from 'react'
import { isLoopbackHostname, redirectUri } from './auth'
import { effectiveClientId, hasBuiltInClientId, useSpotify } from './store'
import { Panel } from '@/components/menu/Panel'
import { Segmented, SectionTitle, Toggle } from '@/components/ui/controls'
import { useSettings } from '@/store/settings'

export function SpotifyPanel() {
  const spotify = useSpotify()
  const connected = spotify.status === 'connected' && Boolean(spotify.tokens)

  return (
    <Panel title="Spotify" wide>
      {connected ? <Connected /> : <Setup />}
      {spotify.error && (
        <p className="rounded-lg bg-red-500/20 px-3 py-2 text-[10px] leading-relaxed text-white/85">
          {spotify.error}
        </p>
      )}
    </Panel>
  )
}

function Setup() {
  const connect = useSpotify((s) => s.connect)
  const status = useSpotify((s) => s.status)
  const override = useSpotify((s) => s.clientId)
  const [advanced, setAdvanced] = useState(!hasBuiltInClientId || Boolean(override))
  const ready = Boolean(effectiveClientId(override))

  return (
    <>
      <div className="flex items-center gap-3 px-1 py-1">
        <SpotifyMark />
        <p className="text-[11px] leading-relaxed text-white/70">
          See what is playing, control it, and sing along with synced lyrics.
        </p>
      </div>

      <button
        type="button"
        disabled={!ready || status === 'connecting'}
        onClick={() => void connect()}
        className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#1db954] text-[13px] font-semibold text-black transition hover:scale-[1.02] hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
      >
        {status === 'connecting' ? 'Opening Spotify…' : 'Connect Spotify'}
      </button>

      <p className="px-1 text-center text-[10px] leading-relaxed text-white/40">
        You&apos;ll sign in on Spotify&apos;s own page and come straight back. Nothing
        but a login token is kept, and only in this browser.
      </p>

      {hasBuiltInClientId ? (
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="self-center px-1 py-1 text-[10px] text-white/40 hover:text-white/70"
        >
          {advanced ? 'Hide' : 'Using your own Spotify app?'}
        </button>
      ) : null}

      {advanced && <OwnApp />}
    </>
  )
}

/** The self-hosting path: bring a Client ID from your own Spotify developer app. */
function OwnApp() {
  const clientId = useSpotify((s) => s.clientId)
  const setClientId = useSpotify((s) => s.setClientId)
  const [copied, setCopied] = useState(false)
  const uri = redirectUri()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(uri)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-2">
      <p className="px-1 text-[10px] leading-relaxed text-white/50">
        {hasBuiltInClientId
          ? 'Only needed if you run your own copy. Leave it empty to use this site’s.'
          : 'This copy has no Spotify app configured, so it needs one of your own.'}
      </p>

      <SectionTitle>1 · Create an app</SectionTitle>
      <a
        href="https://developer.spotify.com/dashboard"
        target="_blank"
        rel="noreferrer"
        className="flex h-9 items-center justify-center rounded-lg bg-white/10 text-[11px] font-medium text-white/85 hover:bg-white/20"
      >
        Open the Spotify developer dashboard →
      </a>

      <SectionTitle>2 · Add this redirect URI</SectionTitle>
      <div className="flex gap-2">
        <code className="flex h-9 min-w-0 flex-1 items-center truncate rounded-lg bg-white/10 px-3 font-mono text-[10px] text-white/85">
          {uri}
        </code>
        <Toggle label={copied ? 'Copied' : 'Copy'} active={copied} onClick={copy} />
      </div>
      {isLoopbackHostname() && (
        <p className="rounded-lg bg-amber-400/15 px-3 py-2 text-[10px] leading-relaxed text-white/80">
          Spotify no longer accepts <code className="font-mono">localhost</code> as a redirect
          host. Reopen Clockit on{' '}
          <a className="underline" href={`http://127.0.0.1:${window.location.port || '5173'}`}>
            127.0.0.1:{window.location.port || '5173'}
          </a>{' '}
          and use the URI shown there instead.
        </p>
      )}

      <SectionTitle>3 · Paste the Client ID</SectionTitle>
      <input
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        placeholder={hasBuiltInClientId ? 'Leave empty to use this site’s app' : '32-character Client ID'}
        spellCheck={false}
        className="h-9 w-full rounded-lg bg-white/10 px-3 font-mono text-[11px] text-white placeholder:font-sans placeholder:text-white/40 focus:outline-none"
      />
    </div>
  )
}

function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1db954" />
      <path
        d="M6.5 9.4c3.7-1.1 8-.8 11.2 1M7.2 12.4c3-.9 6.5-.6 9.2.9M7.8 15.2c2.4-.7 5-.5 7 .7"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function Connected() {
  const deviceName = useSpotify((s) => s.playback?.deviceName ?? null)
  const profile = useSpotify((s) => s.profile)
  const disconnect = useSpotify((s) => s.disconnect)
  const settings = useSettings((s) => s.spotify)
  const setSpotify = useSettings((s) => s.setSpotify)

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2">
        {profile?.image ? (
          <img src={profile.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <SpotifyMark />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[12px] font-semibold text-white">
            {profile ? profile.name : 'Connected'}
          </span>
          <span className="flex items-center gap-1.5 truncate text-[10px] text-white/55">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1db954]" />
            {deviceName ? `Playing on ${deviceName}` : 'Connected to Spotify'}
          </span>
        </div>
      </div>

      {profile?.premium === false && (
        <p className="rounded-lg bg-amber-400/15 px-3 py-2 text-[10px] leading-relaxed text-white/80">
          This is a free Spotify account, so play, skip and seek won&apos;t work — Spotify
          only allows those for Premium. What&apos;s playing and the lyrics still show.
        </p>
      )}

      <SectionTitle>Show</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Toggle
          label="Player"
          active={settings.showNowPlaying}
          onClick={() => setSpotify('showNowPlaying', !settings.showNowPlaying)}
        />
        <Toggle
          label="Lyrics"
          active={settings.showLyrics}
          onClick={() => setSpotify('showLyrics', !settings.showLyrics)}
        />
        <Toggle
          label="Colours"
          active={settings.albumColours}
          onClick={() => setSpotify('albumColours', !settings.albumColours)}
        />
      </div>

      <SectionTitle>Player visibility</SectionTitle>
      <Segmented<'always' | 'fade'>
        value={settings.autoHide ? 'fade' : 'always'}
        onChange={(v) => setSpotify('autoHide', v === 'fade')}
        options={[
          { value: 'always', label: 'Always on screen' },
          { value: 'fade', label: 'Fade when idle' },
        ]}
      />

      <p className="px-1 text-[10px] leading-relaxed text-white/40">
        Album colours repaint the background and the backdrop from the artwork. Lyrics come
        from LRCLIB, a free community database — not every track is in it. Move the player
        and the lyrics from the Layout panel.
      </p>

      <button
        type="button"
        onClick={disconnect}
        className="mt-1 self-start px-1 py-1 text-[10px] text-white/50 hover:text-white"
      >
        Disconnect Spotify
      </button>
    </>
  )
}
