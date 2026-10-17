import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ArrowDown, ArrowUp, Check, MicOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Live } from '../../lib/engine'
import { noteParts, type NoteNaming } from '../../lib/music'

type Tone = 'idle' | 'tune' | 'flat' | 'sharp'

const TONE_COLOR: Record<Tone, string> = { idle: '#6f78b5', tune: '#6ef0c2', flat: '#52b8ff', sharp: '#ff9f5a' }
const RANGE = 100
const W = 320
const H = 96
const MID = H / 2 + 6

interface Display {
  name: string
  octave: number | null
  tone: Tone
  message: string
  target: string | null
  far: 'up' | 'down' | null
}

function describe(live: Live, tol: number, naming: NoteNaming): Display {
  const target = live.target ? noteParts(live.target.midi, naming) : null
  const targetLabel = target ? `${target.name}${target.octave}` : null
  if (live.sung === null || live.cents === null) {
    return {
      name: '–',
      octave: null,
      tone: 'idle',
      message: live.blocked ? 'Begleitung erkannt, sing lauter oder nutze Kopfhörer' : target ? `Sing ${targetLabel}` : 'Sing einen Ton',
      target: targetLabel,
      far: null,
    }
  }
  const sung = noteParts(live.sung, naming)
  const c = Math.round(live.cents)
  const tone: Tone = Math.abs(c) <= tol ? 'tune' : c < 0 ? 'flat' : 'sharp'
  let message: string
  const semis = Math.round(Math.abs(c) / 100)
  if (!live.target) message = tone === 'tune' ? 'Sauber' : `${Math.abs(c)} Cent ${c < 0 ? 'zu tief' : 'zu hoch'}`
  else if (tone === 'tune') message = 'Sauber getroffen'
  else if (Math.abs(c) >= 90) message = `${semis} ${semis === 1 ? 'Halbton' : 'Halbtöne'} ${c < 0 ? 'zu tief' : 'zu hoch'}`
  else message = `${Math.abs(c)} Cent ${c < 0 ? 'zu tief' : 'zu hoch'}`
  return { name: sung.name, octave: sung.octave, tone, message, target: targetLabel, far: Math.abs(c) > RANGE ? (c < 0 ? 'up' : 'down') : null }
}

export default function Tuner({
  getLive,
  tolerance,
  naming,
  micOn,
  waitMode,
  compact = false,
}: {
  getLive: () => Live
  tolerance: number
  naming: NoteNaming
  micOn: boolean
  waitMode: boolean
  /** Phone layout: note and gauge side by side in a short strip. */
  compact?: boolean
}) {
  const [d, setD] = useState<Display>({ name: '–', octave: null, tone: 'idle', message: 'Sing einen Ton', target: null, far: null })
  const cents = useMotionValue(0)
  const smooth = useSpring(cents, { stiffness: 260, damping: 26, mass: 0.6 })
  const voiced = useMotionValue(0)
  const voicedSmooth = useSpring(voiced, { stiffness: 200, damping: 30 })
  const hold = useMotionValue(0)
  const level = useMotionValue(0)

  useEffect(() => {
    let raf = 0
    let last = ''
    const loop = () => {
      const live = getLive()
      if (live.cents !== null) cents.set(Math.max(-RANGE * 1.15, Math.min(RANGE * 1.15, live.cents)))
      voiced.set(live.cents !== null ? 1 : 0)
      hold.set(live.hold)
      level.set(Math.max(0, Math.min(1, (live.levelDb + 70) / 55)))
      const next = describe(live, tolerance, naming)
      const sig = JSON.stringify(next)
      if (sig !== last) {
        last = sig
        setD(next)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [getLive, tolerance, naming, cents, voiced, hold, level])

  const x = useTransform(smooth, (c) => W / 2 + (c / RANGE) * (W / 2 - 14))
  const bend = useTransform([smooth, voicedSmooth], ([c, v]: number[]) => Math.min(Math.abs(c) / RANGE, 1) * 26 * v)
  const string = useTransform([x, bend], ([px, b]: number[]) => `M 8 ${MID} Q ${px} ${MID + b * 2} ${W - 8} ${MID}`)
  const dotY = useTransform(bend, (b) => MID + b)
  const holdWidth = useTransform(hold, (h) => `${h * 100}%`)
  const levelWidth = useTransform(level, (l) => `${l * 100}%`)
  const color = TONE_COLOR[d.tone]
  const tolW = (tolerance / RANGE) * (W / 2 - 14)
  const gaugeContent = (
    <>
          <rect x={W / 2 - tolW} y={MID - 30} width={tolW * 2} height={60} rx={8} fill="rgb(110 240 194 / 0.1)" />
          {[-100, -50, 0, 50, 100].map((c) => {
            const tx = W / 2 + (c / RANGE) * (W / 2 - 14)
            return (
              <g key={c}>
                <line x1={tx} x2={tx} y1={MID - (c === 0 ? 34 : 10)} y2={MID + (c === 0 ? 34 : 10)} stroke={c === 0 ? '#f2d3a6' : 'rgb(255 255 255 / 0.2)'} strokeWidth={c === 0 ? 2 : 1} />
                {c !== 0 && (
                  <text x={tx} y={H - 2} textAnchor="middle" fontSize="10" fill="#6f78b5">
                    {c > 0 ? `+${c}` : `−${-c}`}
                  </text>
                )}
              </g>
            )
          })}
          <motion.path d={string} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" style={{ opacity: d.tone === 'idle' ? 0.35 : 1 }} />
          <motion.circle cx={x} cy={dotY} r={9} fill={color} style={{ opacity: d.tone === 'idle' ? 0 : 1, filter: `drop-shadow(0 0 10px ${color})` }} />
          {d.far && (
            <text x={d.far === 'up' ? 4 : W - 4} y={MID - 16} textAnchor={d.far === 'up' ? 'start' : 'end'} fontSize="11" fontWeight="700" fill={color}>
              {d.far === 'up' ? '◀ höher singen' : 'tiefer singen ▶'}
            </text>
          )}
    </>
  )

  const glow = (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      animate={{ opacity: d.tone === 'tune' ? 1 : 0 }}
      transition={{ duration: 0.25 }}
      style={{ background: 'radial-gradient(60% 50% at 50% 38%, rgb(110 240 194 / 0.18), transparent 70%)' }}
    />
  )

  const noteName = (
    <div className="flex items-start leading-none" aria-live="polite" aria-atomic>
      <motion.span
        key={d.name}
        initial={{ y: 6, opacity: 0.4 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.12 }}
        className={`font-display font-semibold tracking-tight transition-colors duration-150 ${compact ? 'text-6xl' : 'text-[clamp(3.5rem,22cqw,7.5rem)]'}`}
        style={{ color: d.tone === 'idle' ? 'var(--color-dim)' : color }}
      >
        {d.name}
      </motion.span>
      {d.octave !== null && (
        <span className={`mt-[0.4em] ml-1 font-display font-semibold ${compact ? 'text-2xl' : 'text-[clamp(1.25rem,7cqw,2.25rem)]'}`} style={{ color }}>
          {d.octave}
        </span>
      )}
    </div>
  )

  const message = (
    <p className={`flex items-center gap-1.5 font-semibold ${compact ? 'min-h-5 text-xs' : 'min-h-6 text-center text-sm @md:text-base'}`} style={{ color: d.tone === 'idle' ? 'var(--color-mist)' : color }}>
      {!micOn ? (
        <>
          <MicOff size={16} /> Mikrofon ist aus
        </>
      ) : (
        <>
          {d.tone === 'tune' && <Check size={compact ? 15 : 18} />}
          {d.tone === 'flat' && <ArrowUp size={compact ? 15 : 18} />}
          {d.tone === 'sharp' && <ArrowDown size={compact ? 15 : 18} />}
          {d.message}
        </>
      )}
    </p>
  )

  if (compact) {
    return (
      <section aria-label="Stimmgerät" className="surface relative flex items-center gap-3 overflow-hidden px-4 py-2.5">
        {glow}
        <div className="relative w-[9.5rem] shrink-0">
          <p className="text-xs text-mist">
            Ziel <span className="font-display text-sm font-semibold text-gold">{d.target ?? '–'}</span>
          </p>
          {noteName}
          {message}
        </div>
        <div className="relative min-w-0 flex-1">
          {gauge()}
          {waitMode && (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/8">
              <motion.div className="h-full rounded-full bg-tune" style={{ width: holdWidth }} />
            </div>
          )}
        </div>
      </section>
    )
  }

  function gauge() {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="relative w-full" role="img" aria-label="Abweichung in Cent">
        {gaugeContent}
      </svg>
    )
  }

  return (
    <section aria-label="Stimmgerät" className="@container surface relative flex h-full flex-col overflow-hidden p-4 @md:p-5">
      {glow}

      <div className="relative flex items-center justify-between text-sm">
        <span className="text-mist">
          Ziel <span className="font-display text-base font-semibold text-gold">{d.target ?? '–'}</span>
        </span>
        <span className="text-mist">Gesungen</span>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2">
        {noteName}
        {message}
      </div>

      {gauge()}

      {waitMode && (
        <div className="relative mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <motion.div className="h-full rounded-full bg-tune" style={{ width: holdWidth }} />
          </div>
          <p className="mt-1.5 text-xs text-mist">Halte den Ton, bis der Balken voll ist.</p>
        </div>
      )}

      <div className="relative mt-3 flex items-center gap-2 text-xs text-dim">
        <span>Eingang</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan to-violet" style={{ width: levelWidth }} />
        </div>
      </div>
    </section>
  )
}
