import { STORED_GIF } from '@/lib/workspace'
import { mergeSaved, useSettings, type SettingsState } from '@/store/settings'

export interface Snapshot {
  updatedAt: number
  settings: Record<string, unknown>
}

/** Plain data only — the store's actions do not survive JSON, which is the point. */
function plain(state: SettingsState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state)) as Record<string, unknown>
}

/** The settings as they should travel to another device. */
export function currentSettings(): Record<string, unknown> {
  const data = plain(useSettings.getState())
  // An uploaded GIF lives in this browser's IndexedDB, so another device could not
  // show it. Leave it out; each device keeps its own, and `mergeSaved` preserves the
  // local one when the incoming settings have none.
  const workspace = data.workspace as { gif?: { source?: string | null } } | undefined
  if (workspace?.gif?.source === STORED_GIF) delete workspace.gif
  return data
}

/** Lays settings from another device over this one's, through the usual merge. */
export function applySettings(settings: Record<string, unknown>) {
  useSettings.setState(mergeSaved(useSettings.getState(), settings))
}

/**
 * True while this browser still has factory settings. Such a browser has nothing
 * worth sending, and must not seed an empty account with defaults that would then
 * look newer than a real setup on another device.
 */
export function isUntouched(): boolean {
  return stable(plain(useSettings.getInitialState())) === stable(plain(useSettings.getState()))
}

/** JSON with sorted keys, so two equal objects built in different orders compare equal. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}
