# Spotify

Playback control and synced lyrics, talking to Spotify straight from the browser with no
server in between.

## Setup

A deployment bakes its own Client ID in through `VITE_SPOTIFY_CLIENT_ID` (see
`.env.example`). With that set, visitors see one *Connect Spotify* button and never
touch the developer dashboard — PKCE has no secret, so the ID is public by design.

Without it — someone running their own copy — the panel falls back to a walkthrough:

1. Create an app at <https://developer.spotify.com/dashboard>.
2. Add the redirect URI the panel shows, exactly as shown.
3. Paste the Client ID and connect.

A Client ID typed into the panel always wins over the built-in one, which is what lets
a self-hoster point the hosted site at their own app.

**Development Mode.** A new Spotify app admits only accounts its owner has added under
*User Management*, up to 25. Anyone else can complete the login but gets `403` from the
API; `describeForbidden` in `store.ts` reads the response body to tell that apart from a
free account hitting a Premium-only endpoint, so each gets an accurate message.

Spotify no longer accepts `localhost` as a redirect host — it has to be the literal
loopback IP, so run the app on `http://127.0.0.1:5173`. The panel detects `localhost` and
offers the link.

Reading what is playing works on any account. Controlling playback (play/pause, skip,
seek, volume, shuffle, repeat) requires Premium and an already-active device — the Web API
drives a device, it does not become one.

## How it fits together

| File | Role |
| --- | --- |
| `auth.ts` | Authorization Code with PKCE — challenge, redirect, code exchange, refresh |
| `store.ts` | Tokens, playback state, the control actions, and HTTP error mapping |
| `sync.ts` | The poll loop, album-colour extraction trigger, and the lyrics hook |
| `types.ts` | Narrowed `GET /v1/me/player` shapes plus local progress interpolation |
| `lrclib.ts` | Lyrics lookup and `.lrc` parsing |
| `albumPalette.ts` | Samples artwork on a canvas and picks accent and background tones |
| `NowPlaying.tsx` | The player: artwork, title, scrubber, transport, volume — draggable |
| `Lyrics.tsx` | Three-line synced view, mounted under the clock inside the Stage |
| `SpotifyPanel.tsx` | Setup walkthrough and display toggles |

**Polling, not sockets.** Spotify has no push API for playback, so `sync.ts` polls
`/v1/me/player` — 2.5s while playing, 12s while paused, 1s in the last few seconds of a
track so the next one appears promptly, and not at all while the tab is hidden. It also
refreshes on tab focus and whenever the pointer wakes after a lull, so coming back to the
screen shows what is playing *now* rather than whatever the last interval caught. Until
the first poll answers, the player says it is checking rather than showing nothing. Between
polls the progress bar and lyrics interpolate locally from `sampledAt`, so they stay
smooth without extra requests.

**Tokens** live in `localStorage` under `clockit:spotify`, which is the normal arrangement
for a PKCE single-page app — there is no secret to protect, and the refresh token is
scoped to the three read/modify playback scopes. Refreshes are single-flighted so a burst
of calls cannot start several at once.

**Lyrics** come from [LRCLIB](https://lrclib.net), a free keyless community database.
Coverage is good for popular tracks and thin elsewhere; the UI says which case it is
rather than showing nothing. Only the first credited artist is sent, since LRCLIB matches
on a single name.

**Album colours** sample the artwork on a 40×40 canvas, bucket pixels 4 bits per channel,
and rank them by saturation and mid-tone weight with the pixel count square-rooted — so a
mostly-white sleeve yields the colour of its artwork rather than white. Greyscale swatches
are set aside unless the artwork really is monochrome. Only the background and the backdrop
are repainted; flaps and digits keep the user's theme so the clock stays legible whatever
is playing.

**Placing the player.** Its position is stored as a fraction of the viewport rather than
pixels, so it holds its place when the window resizes. Drag it by any part of its
background — `useDragAnchor` in `lib/drag.ts` ignores pointer-downs that land on a button,
input or slider, so the transport and scrubber still work. Six presets and a reset live in
the panel, and everything is re-clamped against the current window so a preset or a resize
can never strand it off-screen.

**Visibility** is either *Always on screen* or *Fade when idle*, the latter fading with the
rest of the chrome after a few seconds without pointer movement. A drag in progress counts
as activity, so the player cannot fade out from under the cursor.

**Drift.** The Stage publishes its burn-in offset as `--drift-x` / `--drift-y`, and the
player composes those into its own transform — so on `Low` or `High` screen protection it
wanders with the clock instead of burning a fixed rectangle into the panel. `DVD` is
deliberately excluded: a clock ricocheting off the edges is a novelty, a control bar doing
it is not, so the Stage publishes zero drift in that mode and bounces only the clock.

**Not available here:** `audio-analysis` and `audio-features` (beat grid, BPM, energy)
were deprecated for newly created apps in November 2024 and return 403 for any Client ID
registered since. The music-reactive backdrops get their beat from live audio capture
instead — see `src/features/audio/README.md`.
