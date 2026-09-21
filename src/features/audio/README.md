# Audio reactivity

Drives the backdrops from whatever is actually playing.

## Why this doesn't come from Spotify

Two independent reasons, both worth knowing before anyone tries to "fix" this by
calling the Web API:

1. **There is no audio stream in the page.** Spotify plays through its own app or
   another device. Nothing is routed through this tab, so there is nothing for the Web
   Audio API to analyse. Even the Web Playback SDK, which does stream in-page, wraps
   playback in EME-protected media that an `AnalyserNode` cannot read.
2. **The analysis endpoints are gone for new apps.** `GET /v1/audio-analysis/{id}`
   (beat grid, bars, sections) and `GET /v1/audio-features/{id}` (BPM, energy,
   danceability) were deprecated for newly created applications in November 2024. A
   Client ID registered today gets `403` from both, so the beat grid that would have
   made this trivial is not available.

So Clockit listens instead. The browser captures real audio and we run our own FFT
over it — which has the side benefit of working for anything playing, not just
Spotify.

## Sources

| Source | API | Notes |
| --- | --- | --- |
| **System** | `getDisplayMedia({ audio: true })` | Share a tab or window and tick "Share audio". Clean signal, no room noise. The video track is stopped immediately — it only exists because the API demands one. |
| **Mic** | `getUserMedia({ audio })` | Works with speakers. Picks up the room along with the music. |

Echo cancellation, noise suppression and auto gain control are all explicitly
disabled: AGC pumps the level, noise suppression eats sustained tones, and echo
cancellation ducks exactly the audio we want.

Neither stream is connected to the audio destination — this is analysis only, and
routing captured system audio back out would feed straight into itself.

The mic can resume on load when the browser already holds the permission. Screen
capture always needs a fresh gesture, so it never resumes automatically.

## What comes out

`readAudio()` returns `{ level, bass, mid, treble, beat, active }`, all 0–1. It is a
plain mutable object rather than React state, because the consumers are animation
loops and a re-render per frame would be waste.

- **Bands** are averaged FFT bins: bass 20–200Hz, mid 200–2000Hz, treble 2–8kHz.
- **Auto-gain** normalises against a slowly decaying peak, so a quiet stream still
  fills the range instead of barely moving the visuals.
- **`beat`** is a decaying envelope set to 1 on each detected onset.

`createBeatDetector()` is the onset detector, split out from the analyser loop so it
can be exercised without an `AudioContext`: bass energy jumping `1.35×` clear of its
own 43-frame rolling average, rate-limited to one hit per 180ms.

## How the backdrops use it

Canvas sims read `readAudio()` each frame and scale the contribution through
`drive()`, which folds in the Reactivity setting:

- **Starfield** — bass drives travel speed, beats flare brightness and streak width.
- **Bokeh** — orbs swell with overall level, rise faster through busy mid-range.
- **Ripple** — fires a ring on every beat, on the rising edge of the envelope so one
  beat makes one ring rather than one per frame while it decays.

CSS backdrops read `--audio-boost`, `--audio-beat`, `--audio-bass` and
`--audio-level` off the root. These sit at neutral (boost 1, the rest 0) whenever
nothing is playing **or** reactivity is 0, so the page looks exactly as it did before
this feature existed. The engine applies the reactivity mix when publishing them;
the raw `levels` stay untouched because the sims apply their own, and scaling in both
places would square it.
