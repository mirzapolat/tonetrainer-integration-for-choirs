import { Gauge, Pause, Play, Repeat, SkipBack, SkipForward, Timer, Volume2 } from 'lucide-react'
import { useState } from 'react'
import type { Mode } from '../../lib/engine'
import type { Visit } from '../../lib/timeline'

interface Props {
  running: boolean
  mode: Mode
  visits: Visit[]
  currentVisit: number
  loop: { startVisit: number; endVisit: number } | null
  factor: number
  bpm: number
  metronome: boolean
  onToggle: () => void
  onRestart: () => void
  onFactor: (f: number) => void
  onLoop: (l: { startVisit: number; endVisit: number } | null) => void
  onMetronome: (v: boolean) => void
  onReference: () => void
  onSkip: () => void
}

export default function TransportBar(p: Props) {
  const [from, setFrom] = useState(p.loop?.startVisit ?? p.currentVisit)
  const [to, setTo] = useState(p.loop?.endVisit ?? Math.min(p.currentVisit + 3, p.visits.length - 1))
  const visit = p.visits[p.currentVisit]
  const label = (v: Visit) => `Takt ${v.number}${p.visits.filter((x) => x.measureIndex === v.measureIndex).length > 1 ? ` (${p.visits.filter((x) => x.measureIndex === v.measureIndex && x.index <= v.index).length}. Mal)` : ''}`
  const closeLoopPopover = () => document.getElementById('loop-popover')?.hidePopover()

  return (
    <footer className="flex items-center gap-2 border-t border-white/7 bg-deep/80 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:gap-3 sm:px-5">
      <button className="icon-btn" onClick={p.onRestart} aria-label={p.loop ? 'Zum Anfang des Abschnitts' : 'Zum Anfang'}>
        <SkipBack size={20} />
      </button>
      <button
        onClick={p.onToggle}
        className="grid size-13 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#f8e2c2] to-gold text-[#2a1d0b] shadow-[0_8px_28px_-8px_rgb(255_180_107/0.8)] transition-transform active:scale-95"
        aria-label={p.running ? 'Pause' : 'Start'}
        title="Leertaste"
      >
        {p.running ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-0.5" />}
      </button>

      {p.mode === 'wait' && (
        <>
          <button className="btn btn-quiet px-3" onClick={p.onReference} title="Taste R">
            <Volume2 size={18} />
            <span className="hidden md:inline">Ton hören</span>
          </button>
          <button className="icon-btn" onClick={p.onSkip} aria-label="Note überspringen" title="Pfeil rechts">
            <SkipForward size={20} />
          </button>
        </>
      )}

      <p className="tabular ml-1 hidden min-w-0 truncate text-sm text-mist sm:block">
        {visit ? label(visit) : ''} <span className="text-dim">von {p.visits[p.visits.length - 1]?.number}</span>
      </p>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {p.mode === 'play' && (
          <>
            <button className="btn btn-quiet px-3" popoverTarget="tempo-popover" aria-label="Tempo">
              <Gauge size={18} />
              <span className="tabular">{Math.round(p.factor * 100)} %</span>
            </button>
            <div id="tempo-popover" popover="auto" className="menu-popover w-72 rounded-2xl bg-raised p-4 text-chalk shadow-2xl shadow-black/50">
              <label className="block">
                <span className="flex items-baseline justify-between">
                  <span className="font-semibold">Tempo</span>
                  <span className="tabular text-sm text-gold">
                    {Math.round(p.factor * 100)} % ({Math.round(p.bpm * p.factor)} BPM)
                  </span>
                </span>
                <input type="range" className="mt-3" min={0.4} max={1.3} step={0.05} value={p.factor} onChange={(e) => p.onFactor(Number(e.target.value))} />
              </label>
              <div className="mt-3 flex gap-1.5">
                {[0.6, 0.75, 0.9, 1].map((f) => (
                  <button key={f} className="btn btn-quiet h-8 flex-1 px-0 text-xs" aria-pressed={Math.abs(p.factor - f) < 0.01} onClick={() => p.onFactor(f)}>
                    {f * 100} %
                  </button>
                ))}
              </div>
              <label className="mt-4 flex cursor-pointer items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <Timer size={16} /> Metronom
                </span>
                <input type="checkbox" role="switch" checked={p.metronome} onChange={(e) => p.onMetronome(e.target.checked)} />
              </label>
            </div>
          </>
        )}

        <button
          className="btn btn-quiet px-3"
          popoverTarget="loop-popover"
          aria-pressed={!!p.loop}
          onClick={() => {
            setFrom(p.loop?.startVisit ?? p.currentVisit)
            setTo(p.loop?.endVisit ?? Math.min(p.currentVisit + 3, p.visits.length - 1))
          }}
        >
          <Repeat size={18} />
          <span className="hidden sm:inline">{p.loop ? `T. ${p.visits[p.loop.startVisit].number}–${p.visits[p.loop.endVisit].number}` : 'Abschnitt'}</span>
        </button>
        <div id="loop-popover" popover="auto" className="menu-popover w-80 rounded-2xl bg-raised p-4 text-chalk shadow-2xl shadow-black/50">
          <p className="font-semibold">Abschnitt in Schleife üben</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-sm text-mist">
              von
              <select className="mt-1 w-full" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
                {p.visits.map((v) => (
                  <option key={v.index} value={v.index}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-mist">
              bis
              <select className="mt-1 w-full" value={to} onChange={(e) => setTo(Number(e.target.value))}>
                {p.visits.map((v) => (
                  <option key={v.index} value={v.index} disabled={v.index < from}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            {p.loop && (
              <button
                className="btn btn-quiet flex-1"
                onClick={() => {
                  p.onLoop(null)
                  closeLoopPopover()
                }}
              >
                Schleife beenden
              </button>
            )}
            <button
              className="btn btn-primary flex-1"
              onClick={() => {
                p.onLoop({ startVisit: from, endVisit: Math.max(from, to) })
                closeLoopPopover()
              }}
            >
              Schleife starten
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
