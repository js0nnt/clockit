import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  micAlreadyGranted,
  onSourceEnded,
  startAudio,
  stopAudio,
  type AudioSource,
} from './engine'

interface AudioState {
  source: AudioSource
  status: 'idle' | 'starting' | 'listening' | 'error'
  error: string | null

  select: (source: AudioSource) => Promise<void>
  /** Re-opens the mic on load when the browser already holds the permission. */
  resume: () => Promise<void>
}

export const useAudio = create<AudioState>()(
  persist(
    (set, get) => ({
      source: 'off',
      status: 'idle',
      error: null,

      select: async (source) => {
        if (source === 'off') {
          stopAudio()
          set({ source: 'off', status: 'idle', error: null })
          return
        }

        set({ status: 'starting', error: null })
        try {
          await startAudio(source)
          set({ source, status: 'listening', error: null })
          // Stopping the share from the browser's own banner ends the track.
          onSourceEnded(() => {
            stopAudio()
            set({ source: 'off', status: 'idle' })
          })
        } catch (e) {
          stopAudio()
          set({
            source: 'off',
            status: 'error',
            error: describe(e),
          })
        }
      },

      resume: async () => {
        // Screen capture always needs a fresh gesture, so only the mic can return
        // on its own — and only if the permission is already granted.
        if (get().source !== 'mic') return
        if (!(await micAlreadyGranted())) {
          set({ source: 'off', status: 'idle' })
          return
        }
        await get().select('mic')
      },
    }),
    {
      name: 'clockit:audio',
      version: 1,
      partialize: (s) => ({ source: s.source }),
    },
  ),
)

function describe(error: unknown): string {
  if (!(error instanceof Error)) return 'Could not start listening.'
  if (error.name === 'NotAllowedError') return 'Permission denied — nothing is being captured.'
  if (error.name === 'NotFoundError') return 'No audio input was found.'
  return error.message
}
