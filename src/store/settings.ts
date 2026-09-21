import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_THEME, THEME_BY_ID } from '@/lib/themes'
import { useAlbumPalette } from '@/features/spotify/albumPalette'
import {
  DEFAULT_WORKSPACE,
  fitToGrid,
  type BentoSpot,
  type FreeSpot,
  type GifSettings,
  type Workspace,
  type WidgetId,
} from '@/lib/workspace'
import type {
  AnimationSettings,
  BackdropSettings,
  ClockMode,
  ColorSpec,
  ColorTarget,
  FlipSound,
  FontId,
  LayoutSettings,
  ScreenProtect,
  Theme,
} from '@/lib/types'

export interface SavedPreset {
  id: string
  name: string
  createdAt: number
  state: PortableState
}

/** The subset of settings that travels in a preset or a share code. */
export interface PortableState {
  themeId: string
  custom: Record<ColorTarget, ColorSpec> | null
  font: FontId
  layout: LayoutSettings
  animation: AnimationSettings
  showSeconds: boolean
  hour24: boolean
  continuous: boolean
  backdrop: BackdropSettings
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  clockScale: 0.8,
  singleFlap: false,
  tileWidth: 0.52,
  textSize: 0.82,
  textOffset: 0,
  fontThickness: 500,
  edgeRounding: 0.12,
  centreRounding: 0,
  groupSpacing: 0.34,
  flapGap: 0.008,
  digitGap: 0.04,
}

export const DEFAULT_BACKDROP: BackdropSettings = {
  id: 'aurora',
  speed: 1,
  intensity: 0.65,
  accent: true,
  reactivity: 0.7,
}

export const DEFAULT_ANIMATION: AnimationSettings = {
  perspective: 1200,
  depth: 0.45,
  bounce: 0.25,
  delay: 520,
}

export interface SpotifySettings {
  /** show the now-playing bar at the top of the screen */
  showNowPlaying: boolean
  /** show synced lyrics under the clock */
  showLyrics: boolean
  /** recolour the background and backdrop from the album artwork */
  albumColours: boolean
  /** let the now-playing bar fade out with the rest of the chrome */
  autoHide: boolean
}

export const DEFAULT_SPOTIFY: SpotifySettings = {
  showNowPlaying: true,
  showLyrics: false,
  albumColours: false,
  autoHide: true,
}

interface SettingsState extends PortableState {
  mode: ClockMode
  hideClock: boolean
  screenProtect: ScreenProtect
  flipSound: FlipSound
  volume: number
  pomodoro: { focus: number; break: number; longBreak: number; rounds: number }
  presets: SavedPreset[]
  spotify: SpotifySettings
  workspace: Workspace

  setMode: (mode: ClockMode) => void
  toggle: (key: 'showSeconds' | 'hour24' | 'continuous' | 'hideClock') => void
  setScreenProtect: (v: ScreenProtect) => void
  setFont: (font: FontId) => void
  setFlipSound: (s: FlipSound) => void
  setVolume: (v: number) => void
  setLayout: <K extends keyof LayoutSettings>(key: K, value: LayoutSettings[K]) => void
  setAnimation: <K extends keyof AnimationSettings>(key: K, value: AnimationSettings[K]) => void
  setBackdrop: <K extends keyof BackdropSettings>(key: K, value: BackdropSettings[K]) => void
  setPomodoro: (key: keyof SettingsState['pomodoro'], value: number) => void
  setSpotify: <K extends keyof SpotifySettings>(key: K, value: SpotifySettings[K]) => void
  setWorkspace: <K extends keyof Workspace>(key: K, value: Workspace[K]) => void
  setFreeSpot: (id: WidgetId, spot: FreeSpot) => void
  setBentoSpot: (id: WidgetId, spot: BentoSpot) => void
  setGif: <K extends keyof GifSettings>(key: K, value: GifSettings[K]) => void
  resizeGrid: (columns: number, rows: number) => void
  applyTheme: (themeId: string) => void
  setColor: (target: ColorTarget, patch: Partial<ColorSpec>) => void
  resetCustom: () => void
  resetAll: () => void
  savePreset: (name: string) => void
  applyPreset: (id: string) => void
  deletePreset: (id: string) => void
  importState: (state: PortableState) => void
}

const initial: PortableState = {
  themeId: DEFAULT_THEME.id,
  custom: null,
  font: 'inter',
  layout: DEFAULT_LAYOUT,
  animation: DEFAULT_ANIMATION,
  showSeconds: true,
  hour24: false,
  continuous: false,
  backdrop: DEFAULT_BACKDROP,
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initial,
      mode: 'clock',
      hideClock: false,
      screenProtect: 'high',
      flipSound: 'off',
      volume: 0.5,
      pomodoro: { focus: 25, break: 5, longBreak: 15, rounds: 4 },
      presets: [],
      spotify: DEFAULT_SPOTIFY,
      workspace: DEFAULT_WORKSPACE,

      setMode: (mode) => set({ mode }),
      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<SettingsState>),
      setScreenProtect: (screenProtect) => set({ screenProtect }),
      setFont: (font) => set({ font }),
      setFlipSound: (flipSound) => set({ flipSound }),
      setVolume: (volume) => set({ volume }),
      setLayout: (key, value) => set((s) => ({ layout: { ...s.layout, [key]: value } })),
      setAnimation: (key, value) => set((s) => ({ animation: { ...s.animation, [key]: value } })),
      setBackdrop: (key, value) => set((s) => ({ backdrop: { ...s.backdrop, [key]: value } })),
      setPomodoro: (key, value) => set((s) => ({ pomodoro: { ...s.pomodoro, [key]: value } })),
      setSpotify: (key, value) => set((s) => ({ spotify: { ...s.spotify, [key]: value } })),

      setWorkspace: (key, value) => set((s) => ({ workspace: { ...s.workspace, [key]: value } })),

      setFreeSpot: (id, spot) =>
        set((s) => ({
          workspace: {
            ...s.workspace,
            placements: {
              ...s.workspace.placements,
              [id]: { ...s.workspace.placements[id], free: spot },
            },
          },
        })),

      setBentoSpot: (id, spot) =>
        set((s) => ({
          workspace: {
            ...s.workspace,
            placements: {
              ...s.workspace.placements,
              [id]: { ...s.workspace.placements[id], bento: spot },
            },
          },
        })),

      setGif: (key, value) =>
        set((s) => ({ workspace: { ...s.workspace, gif: { ...s.workspace.gif, [key]: value } } })),

      // Shrinking the grid can strand a widget outside it, so every placement is
      // pulled back inside as part of the same update.
      resizeGrid: (columns, rows) =>
        set((s) => {
          const placements = { ...s.workspace.placements }
          for (const id of Object.keys(placements) as WidgetId[]) {
            placements[id] = {
              ...placements[id],
              bento: fitToGrid(placements[id].bento, columns, rows),
            }
          }
          return { workspace: { ...s.workspace, columns, rows, placements } }
        }),

      // Selecting a style drops any custom colours so the style is what you see.
      applyTheme: (themeId) => set({ themeId, custom: null }),

      setColor: (target, patch) =>
        set((s) => {
          const base = s.custom ?? colorsOf(THEME_BY_ID.get(s.themeId) ?? DEFAULT_THEME)
          return { custom: { ...base, [target]: { ...base[target], ...patch } } }
        }),

      resetCustom: () => set({ custom: null }),
      resetAll: () => set({ ...initial, mode: get().mode }),

      savePreset: (name) =>
        set((s) => ({
          presets: [
            ...s.presets,
            { id: crypto.randomUUID(), name, createdAt: Date.now(), state: portable(s) },
          ],
        })),

      applyPreset: (id) => {
        const preset = get().presets.find((p) => p.id === id)
        if (preset) set(normalize(preset.state))
      },

      deletePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
      importState: (state) => set(normalize(state)),
    }),
    {
      name: 'clockit:settings',
      version: 1,
      partialize: (s) => ({ ...s, mode: s.mode }),
      /**
       * The default merge is shallow, so a settings blob saved before a nested field
       * existed would replace the whole group and leave that field undefined. Merging
       * each group against its defaults keeps older saves loading as new ones ship.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>
        return {
          ...current,
          ...saved,
          layout: { ...current.layout, ...saved.layout },
          animation: { ...current.animation, ...saved.animation },
          backdrop: { ...current.backdrop, ...saved.backdrop },
          pomodoro: { ...current.pomodoro, ...saved.pomodoro },
          spotify: { ...current.spotify, ...saved.spotify },
          workspace: mergeWorkspace(current.workspace, saved),
        }
      },
    },
  ),
)

/**
 * The player used to carry its own `spotify.position`; it is a workspace placement
 * now, so an older save hands its value over rather than losing where it was put.
 */
function mergeWorkspace(current: Workspace, saved: Partial<SettingsState>): Workspace {
  const legacy = (saved.spotify as { position?: FreeSpot } | undefined)?.position
  const workspace = saved.workspace
  const placements = { ...current.placements }

  for (const id of Object.keys(placements) as WidgetId[]) {
    placements[id] = {
      free: { ...placements[id].free, ...workspace?.placements?.[id]?.free },
      bento: { ...placements[id].bento, ...workspace?.placements?.[id]?.bento },
    }
  }
  if (legacy && !workspace?.placements?.player) placements.player.free = legacy

  return {
    ...current,
    ...workspace,
    placements,
    gif: { ...current.gif, ...workspace?.gif },
  }
}

/** Presets and share codes made before a field existed arrive without it. */
function normalize(state: PortableState): PortableState {
  return {
    ...initial,
    ...state,
    layout: { ...DEFAULT_LAYOUT, ...state.layout },
    animation: { ...DEFAULT_ANIMATION, ...state.animation },
    backdrop: { ...DEFAULT_BACKDROP, ...state.backdrop },
  }
}

export function colorsOf(theme: Theme): Record<ColorTarget, ColorSpec> {
  return { flap: theme.flap, digits: theme.digits, background: theme.background }
}

export function portable(s: PortableState): PortableState {
  return {
    themeId: s.themeId,
    custom: s.custom,
    font: s.font,
    layout: { ...s.layout },
    animation: { ...s.animation },
    showSeconds: s.showSeconds,
    hour24: s.hour24,
    continuous: s.continuous,
    backdrop: { ...s.backdrop },
  }
}

/**
 * Resolved colours: the active style, then any custom overrides, then the album
 * artwork's background if that is switched on. Flaps and digits are never taken from
 * artwork, so the clock stays legible whatever is playing.
 */
export function useColors(): Record<ColorTarget, ColorSpec> {
  const themeId = useSettings((s) => s.themeId)
  const custom = useSettings((s) => s.custom)
  const albumColours = useSettings((s) => s.spotify.albumColours)
  const palette = useAlbumPalette((s) => s.palette)

  const base = custom ?? colorsOf(THEME_BY_ID.get(themeId) ?? DEFAULT_THEME)
  if (!albumColours || !palette) return base
  return { ...base, background: palette.background }
}

export function useActiveTheme(): Theme {
  const themeId = useSettings((s) => s.themeId)
  return THEME_BY_ID.get(themeId) ?? DEFAULT_THEME
}
