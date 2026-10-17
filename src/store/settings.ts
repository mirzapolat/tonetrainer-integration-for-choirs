import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NoteNaming } from '../lib/music'

export type Sensitivity = 'tolerant' | 'normal' | 'strict'

export const CLARITY: Record<Sensitivity, number> = { tolerant: 0.8, normal: 0.86, strict: 0.92 }

export interface Settings {
  /** Cents within which a note counts as hit. */
  tolerance: number
  ignoreOctave: boolean
  headphones: boolean
  naming: NoteNaming
  a4: number
  micDeviceId: string | null
  countIn: boolean
  metronome: boolean
  /** Wait mode: play the next target note automatically. */
  refTone: boolean
  sensitivity: Sensitivity
  showAllParts: boolean
  /** Phones have little room for the score, so only the own voice is shown by default. */
  showAllPartsMobile: boolean
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      tolerance: 25,
      ignoreOctave: false,
      headphones: true,
      naming: 'de',
      a4: 440,
      micDeviceId: null,
      countIn: true,
      metronome: false,
      refTone: true,
      sensitivity: 'normal',
      showAllParts: true,
      showAllPartsMobile: false,
      set: (patch) => set(patch),
    }),
    { name: 'tonetrainer-settings' },
  ),
)
