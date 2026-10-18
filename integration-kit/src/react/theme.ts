import { useLayoutEffect, useState, type RefObject } from 'react'
import type { Grade } from '../core/types'

/**
 * Colours used by canvas (piano roll), SVG (tuner) and the engraved score. They are read from CSS
 * custom properties on the trainer root, so restyling happens in CSS only (see tonetrainer.css).
 */
export interface TrainerColors {
  tune: string
  flat: string
  sharp: string
  silent: string
  ok: string
  accent: string
  accentGlow: string
  free: string
  rollUpcoming: string
  rollPast: string
  rollOther: string
  rollRowShade: string
  rollGrid: string
  rollMeasure: string
  rollLabel: string
  rollLabelStrong: string
  rollLoop: string
  rollNoteText: string
  rollNoteTextCurrent: string
  scoreInk: string
  scoreOther: string
  scoreCursor: string
  paperGood: string
  paperOk: string
  paperFlat: string
  paperSharp: string
  paperSilent: string
}

const VARS: Record<keyof TrainerColors, [string, string]> = {
  tune: ['--tt-tune', '#6ef0c2'],
  flat: ['--tt-flat', '#52b8ff'],
  sharp: ['--tt-sharp', '#ff9f5a'],
  silent: ['--tt-silent', '#7d86bd'],
  ok: ['--tt-ok', '#f2d3a6'],
  accent: ['--tt-accent', '#f2d3a6'],
  accentGlow: ['--tt-accent-glow', '#ffb46b'],
  free: ['--tt-free', '#c9c8f5'],
  rollUpcoming: ['--tt-roll-upcoming', 'rgb(201 200 245 / 0.55)'],
  rollPast: ['--tt-roll-past', 'rgb(201 200 245 / 0.22)'],
  rollOther: ['--tt-roll-other', 'rgb(201 200 245 / 0.13)'],
  rollRowShade: ['--tt-roll-row-shade', 'rgb(4 8 40 / 0.35)'],
  rollGrid: ['--tt-roll-grid', 'rgb(255 255 255 / 0.05)'],
  rollMeasure: ['--tt-roll-measure', 'rgb(255 255 255 / 0.13)'],
  rollLabel: ['--tt-roll-label', '#6f78b5'],
  rollLabelStrong: ['--tt-roll-label-strong', '#a9b0de'],
  rollLoop: ['--tt-roll-loop', 'rgb(63 208 255 / 0.07)'],
  rollNoteText: ['--tt-roll-note-text', 'rgb(7 13 51 / 0.8)'],
  rollNoteTextCurrent: ['--tt-roll-note-text-current', '#2a1d0b'],
  scoreInk: ['--tt-score-ink', '#161b3d'],
  scoreOther: ['--tt-score-other', '#9aa0c4'],
  scoreCursor: ['--tt-score-cursor', '#ffb46b'],
  paperGood: ['--tt-paper-good', '#0e9c78'],
  paperOk: ['--tt-paper-ok', '#a87a1e'],
  paperFlat: ['--tt-paper-flat', '#2f63d1'],
  paperSharp: ['--tt-paper-sharp', '#d9581f'],
  paperSilent: ['--tt-paper-silent', '#8a90b0'],
}

export function readColors(el: Element = document.documentElement): TrainerColors {
  const cs = getComputedStyle(el)
  const out = {} as TrainerColors
  for (const [k, [v, fallback]] of Object.entries(VARS) as [keyof TrainerColors, [string, string]][]) {
    out[k] = cs.getPropertyValue(v).trim() || fallback
  }
  return out
}

export const DEFAULT_COLORS: TrainerColors = Object.fromEntries(Object.entries(VARS).map(([k, [, f]]) => [k, f])) as unknown as TrainerColors

/**
 * Reads the colours once the root element is mounted (and again when `deps` change, e.g. a theme
 * switch). Returns null until then, so the score is not engraved with fallback colours.
 */
export function useTrainerColors(root: RefObject<Element | null>, deps: unknown[] = []) {
  const [colors, setColors] = useState<TrainerColors | null>(null)
  useLayoutEffect(() => {
    if (root.current) setColors(readColors(root.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return colors
}

export function gradeColor(c: TrainerColors, g: Grade) {
  return { good: c.tune, ok: c.ok, flat: c.flat, sharp: c.sharp, silent: c.silent }[g]
}

/** Grade colours tuned for the white score paper. */
export function paperGradeColor(c: TrainerColors, g: Grade) {
  return { good: c.paperGood, ok: c.paperOk, flat: c.paperFlat, sharp: c.paperSharp, silent: c.paperSilent }[g]
}

/** Colour for an accuracy value 0..1 (results, heatmap). */
export function accuracyColor(c: TrainerColors, acc: number) {
  return acc >= 0.85 ? c.tune : acc >= 0.6 ? c.ok : c.sharp
}
