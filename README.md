# Clockit

An aesthetic flip clock for the browser — clock, pomodoro and stopwatch — modelled on
[flipcloc.com](https://flipcloc.com), with animated backdrops and Spotify built in.

```bash
npm install
npm run dev
```

## Deploying to Vercel

It is a static Vite build, so Vercel detects everything except the Spotify app:

1. **Import the repo** at [vercel.com/new](https://vercel.com/new). Framework, build
   command (`npm run build`) and output (`dist`) are all detected.
2. **Add the environment variable** `VITE_SPOTIFY_CLIENT_ID` with your Spotify app's
   Client ID, then deploy. Visitors then get a single *Connect Spotify* button.
3. **Register the production URL** in your Spotify app's settings as a redirect URI —
   exactly `https://your-project.vercel.app`, no trailing slash.
4. **Add storage for settings sync** (optional): *Storage → Create Database → Upstash
   for Redis*, connected to this project, then redeploy. Signed-in users' setups then
   follow their Spotify account to any device. Without it everything still works, and
   settings are simply kept per browser.

`VITE_SPOTIFY_CLIENT_ID` is baked in when the site is **built**, so adding or changing it
needs a redeploy (*Deployments → ⋯ → Redeploy*). A build without it prints a warning and
falls back to asking visitors for their own Client ID.

Two Spotify limits worth knowing before sharing the link:

- **Development Mode caps an app at 25 users**, and each one has to be added by email
  under *User Management* in the Spotify dashboard. Anyone else can sign in but gets
  refused; Clockit tells them to ask you to add them. Lifting the cap needs Extended
  Quota Mode, which Spotify now only grants to registered organisations, not
  individual developers.
- **Preview deployments won't log in.** Each gets its own URL, and Spotify only accepts
  registered redirect URIs. Test Spotify on the production domain (or add a stable
  preview alias as a second redirect URI).

For local development, copy `.env.example` to `.env.local` and fill it in — or leave it
empty and paste a Client ID in the Spotify panel instead. `vite dev` does not run the
function in `api/`, so settings sync is off locally unless `CLOCKIT_API_TARGET` points
the dev server at a deployment.

## Features

**Clock** — 12/24 hour, seconds on or off, continuous mode (each flip stretched across the full second), hide clock,
screen-burn protection (`Off` / `Low` / `High` / `DVD`), and Picture-in-Picture.

**Modes** — wall clock, pomodoro with focus/break/long-break phases and automatic phase
advance, and a stopwatch.

**Font** — Inter, Mono, Playfair, Inter Bold, Baskerville, Saira.

**Flaps** — clock scale, single-flap mode, tile width, text size, text offset, font
thickness, edge rounding, centre rounding, H:M:S spacing, flap gap, digit gap.

**Animation & sounds** — perspective, fold depth, bounce and flip duration; four
synthesised flip voices with a volume control (no audio assets — everything is WebAudio).

**Backdrop** — seven animated layers behind the clock, each drawing its colours from the
active style so a theme change restyles the motion too. `Aurora` (drifting light blooms),
`Rays` (soft diagonal bands), `Tide` (liquid crests rolling underneath), `Grid` (a horizon
grid running to vanishing point), `Starfield`, `Bokeh`, and `Ripple` — which fires a ring
on every flip, harder on a minute or hour rollover. Speed, intensity, and whether the
effect borrows the flap/digit colours or stays inside the background's own two stops.

**Layout** — two modes for arranging the clock, player, lyrics and a GIF. *Free* lets you
drag each one anywhere, with optional snapping to a grid, to the screen centre and to the
other widgets (a guide shows when one catches); positions are stored as a fraction of the
viewport so they survive a resize. Hovering any widget reveals a reset button that puts
that one back where it started. *Bento* snaps them into a grid you size yourself (2–8 columns, 2–6 rows, with
gap and margin): drag a box between cells, pull its bottom-right corner to resize, and a
move onto occupied cells snaps back rather than stacking. The GIF takes a link or an
uploaded file, and fills or fits its box.

**Settings follow you** — sign in with Spotify and your whole setup (theme, layout,
backdrop, widget positions, presets) comes with you to any device. The most recent change
wins, a stale device can never roll a newer save backwards, and a fresh browser never
overwrites a real setup with factory defaults.

**Spotify** — connect your own Spotify app and control whatever is already playing: a
draggable player with artwork, scrubber, transport, shuffle, repeat and volume, set to
stay on screen or fade when idle; synced
lyrics under the clock; and an album-colours mode that repaints the background and the
backdrop from the artwork. See [the feature README](src/features/spotify/README.md) for
setup — it needs a Client ID you create, and Premium for playback control.

**Music reactivity** — the backdrops move to whatever is playing. Share your system
audio or use the mic, and an FFT drives them live: bass pushes the starfield, orbs swell
with loudness, and Ripple fires a ring on every beat. Spotify cannot supply this — see
[the feature README](src/features/audio/README.md) for why, and what Clockit does instead.

**Colours** — 20 built-in styles across two families, plus a custom editor that paints the
flap, the digits and the background independently (solid / linear / radial, with rotation
and radial placement). Named presets and copy-paste share codes are stored locally.

Everything persists to `localStorage`. Keyboard: `F` fullscreen, `H` hide clock,
`S` seconds, `T` 24-hour, `Space` start/pause a timer.

## Layout

```
api/
  settings.ts   Vercel function: stores settings per Spotify user in Upstash Redis
src/
  lib/          types, themes, paint (gradients), time, fonts, sound, share codes, PiP, hooks
  store/        settings (persisted), timer (runtime), pulse (clock -> backdrop channel)
  lib/          types, themes, paint, time, fonts, sound, share codes, drag, workspace
  components/   FlipClock, FlipTile, Stage, TimerControls
    workspace/  free and bento layout, widget dragging, the GIF widget
    backdrops/  the animated background layers and their canvas simulations
    menu/       the circular icon menu and its six panels
    ui/         sliders, segmented controls, toggles, colour fields
  features/
    sync/       settings that follow the Spotify account across devices
    audio/      live capture, FFT, band levels and beat detection — see its README
    spotify/    PKCE auth, playback polling, lyrics, album colours — see its README
```

The flip itself is four layers per tile: a static top showing the incoming digit, a static
bottom still showing the outgoing one, and two leaves that fold across the seam. All
geometry comes from CSS custom properties set on `.clock`, so every slider is a single
variable change rather than a re-layout.

CSS backdrops are keyframe layers driven by `--bd-*` custom properties; canvas backdrops
implement the `Sim` interface in `components/backdrops/sims.ts` — `reset` on every resize,
`frame` per animation frame, and an optional `subscribe` for the clock's flip pulses.
Adding one means a `Sim` and an entry in `lib/backdrops.ts`.

## Layout internals

Every widget carries two placements: a `free` anchor (a fraction of the viewport, so it
holds its spot across resizes) and a `bento` rectangle of grid cells. Switching modes
swaps which one is read, so each layout is remembered independently.

The clock sizes itself from a *budget* rather than the window — the viewport in free mode,
the measured cell in bento — which is what lets the same component fill a 1×1 box and a
full screen. In a box too narrow for three groups it wraps to two rows, the same rule that
handles phones.

An uploaded GIF is kept in IndexedDB rather than `localStorage`: settings share a ~5MB
budget there, a GIF would blow it out, and an over-quota write fails silently.
