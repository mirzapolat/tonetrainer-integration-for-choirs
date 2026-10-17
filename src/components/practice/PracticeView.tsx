import { motion } from 'framer-motion'
import { ArrowLeft, BarChart3, Headphones, Hourglass, Mic as MicIcon, Music2, Settings2, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { href } from '../../App'
import { Mic } from '../../lib/audio/mic'
import { Player, type Channel } from '../../lib/audio/player'
import { audioContext } from '../../lib/audio/synth'
import { db, type Grade, type SessionRecord, type SongRecord } from '../../lib/db'
import { PracticeEngine, type EngineConfig, type Mode } from '../../lib/engine'
import { parseScore, type ParsedScore } from '../../lib/musicxml/parse'
import { Timeline } from '../../lib/timeline'
import { CLARITY, useSettings } from '../../store/settings'
import { Segmented } from '../ui'
import { MixerDialog, presetMix, ResultsDialog, SettingsDialog, TrackPicker } from './dialogs'
import PianoRoll from './PianoRoll'
import ScoreView, { type ScoreHandle } from './ScoreView'
import TransportBar from './TransportBar'
import Tuner from './Tuner'

/** Grade colours darkened for legibility on the white score paper. */
const PAPER_COLOR: Record<Grade, string> = { good: '#0e9c78', ok: '#a87a1e', flat: '#2f63d1', sharp: '#d9581f', silent: '#8a90b0' }

type MicState = 'off' | 'starting' | 'on' | 'error'

function useIsCompact() {
  const query = '(max-width: 1023px)'
  const [compact, setCompact] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const on = () => setCompact(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return compact
}

export default function PracticeView({ songId, loopMeasure: initialLoop }: { songId: string; loopMeasure?: number }) {
  const settings = useSettings()
  const compact = useIsCompact()
  const [song, setSong] = useState<SongRecord | null | undefined>(undefined)
  const [order, setOrder] = useState<number[] | null>(null)
  const [trackId, setTrackId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [mixerOpen, setMixerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mixer, setMixer] = useState<Record<string, Channel>>({})
  const [zoom, setZoom] = useState(compact ? 0.62 : 0.85)
  const [factor, setFactor] = useState(1)
  const [engine, setEngine] = useState<PracticeEngine | null>(null)
  const [micState, setMicState] = useState<MicState>('off')
  const [micError, setMicError] = useState<string | null>(null)
  const [currentVisit, setCurrentVisit] = useState(0)
  const [results, setResults] = useState<{ session: SessionRecord; previous: SessionRecord | null } | null>(null)
  const [, rerender] = useReducer((x: number) => x + 1, 0)

  const scoreRef = useRef<ScoreHandle>(null)
  const playerRef = useRef<Player | null>(null)
  const engineRef = useRef<PracticeEngine | null>(null)
  const micRef = useRef<Mic | null>(null)

  useEffect(() => {
    db.song(songId).then((s) => {
      setSong(s ?? null)
      if (!s) return
      const savedZoom = matchMedia('(max-width: 1023px)').matches ? s.prefs.zoomMobile : s.prefs.zoom
      if (savedZoom) setZoom(savedZoom)
      if (s.prefs.tempoFactor) setFactor(s.prefs.tempoFactor)
      if (s.prefs.trackId && s.tracks.some((t) => t.id === s.prefs.trackId)) setTrackId(s.prefs.trackId)
      else setPickerOpen(true)
    })
  }, [songId])

  const parsed = useMemo<{ score: ParsedScore | null; error: string | null }>(() => {
    if (!song) return { score: null, error: null }
    try {
      return { score: parseScore(song.xml), error: null }
    } catch (e) {
      return { score: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [song])
  const score = parsed.score

  const timeline = useMemo(() => (score && order ? new Timeline(score, order) : null), [score, order])
  const onLayout = useCallback((o: number[]) => setOrder((prev) => (prev && prev.length === o.length && prev.every((v, i) => v === o[i]) ? prev : o)), [])

  // Player lives as long as the timeline.
  useEffect(() => {
    if (!timeline) return
    const p = new Player(audioContext(), timeline)
    playerRef.current = p
    return () => {
      p.dispose()
      playerRef.current = null
    }
  }, [timeline])

  const saveSession = useCallback(
    (e: PracticeEngine) => {
      const s = e.summary(songId)
      e.resetSession()
      if (s) void db.addSession(s)
      return s
    },
    [songId],
  )

  const config = (): EngineConfig => {
    const s = useSettings.getState()
    return { tolerance: s.tolerance, ignoreOctave: s.ignoreOctave, headphones: s.headphones, refTone: s.refTone, countIn: s.countIn }
  }

  // One engine per (timeline, voice). Switching voice stores the running session first.
  useEffect(() => {
    const player = playerRef.current
    if (!timeline || !trackId || !player) return
    const e = new PracticeEngine(timeline, player, trackId, config())
    e.mic = micRef.current
    player.setFactor(factor)
    engineRef.current = e
    setEngine(e)
    if (import.meta.env.DEV) Object.assign(window, { __engine: e })
    const off = e.on((ev) => {
      if (ev.type === 'graded') {
        const n = e.notes[ev.idx]
        scoreRef.current?.colorNote(e.track.partIndex, e.track.voice, n.measureIndex, n.offsetQ, ev.grade ? PAPER_COLOR[ev.grade] : null)
      } else if (ev.type === 'finished') {
        const s = saveSession(e)
        if (s) {
          db.sessions(songId).then((all) => {
            const previous = all.filter((x) => x.trackId === s.trackId && x.id !== s.id && x.notes > 0).at(-1) ?? null
            setResults({ session: s, previous })
          })
        }
        rerender()
      } else rerender()
    })
    return () => {
      off()
      saveSession(e)
      e.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline, trackId])

  // Mixer: saved per song, otherwise the "learn" preset for the chosen voice.
  useEffect(() => {
    if (!timeline || !trackId || !song) return
    const saved = song.prefs.mixer
    setMixer(saved && song.prefs.trackId === trackId && Object.keys(saved).length === timeline.tracks.length ? saved : presetMix(timeline.tracks, trackId))
  }, [timeline, trackId, song])
  useEffect(() => {
    playerRef.current?.setMix(mixer)
  }, [mixer, engine])

  // Persist per-song preferences.
  useEffect(() => {
    if (!trackId || !Object.keys(mixer).length) return
    const t = setTimeout(() => db.updateSong(songId, { prefs: { trackId, mixer, tempoFactor: factor, [compact ? 'zoomMobile' : 'zoom']: zoom } }), 400)
    return () => clearTimeout(t)
  }, [songId, trackId, mixer, zoom, factor, compact])

  // Settings → engine, player, tracker.
  useEffect(() => {
    engine?.setConfig(config())
    const p = playerRef.current
    if (p) {
      p.a4 = settings.a4
      p.metronome = settings.metronome
    }
    micRef.current?.tracker.configure({ a4: settings.a4, minClarity: CLARITY[settings.sensitivity] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, settings.tolerance, settings.ignoreOctave, settings.headphones, settings.refTone, settings.countIn, settings.a4, settings.metronome, settings.sensitivity])

  const enableMic = useCallback(async () => {
    setMicState('starting')
    setMicError(null)
    const ctx = audioContext()
    await ctx.resume()
    micRef.current?.close()
    const s = useSettings.getState()
    const opts = { deviceId: s.micDeviceId, echoCancellation: !s.headphones, a4: s.a4, minClarity: CLARITY[s.sensitivity] }
    try {
      let mic: Mic
      try {
        mic = await Mic.open(ctx, opts)
      } catch (err) {
        if (!s.micDeviceId || (err as Error).name !== 'OverconstrainedError') throw err
        mic = await Mic.open(ctx, { ...opts, deviceId: null })
      }
      micRef.current = mic
      if (engineRef.current) engineRef.current.mic = mic
      setMicState('on')
      return true
    } catch (err) {
      const name = (err as Error).name
      setMicError(
        name === 'NotAllowedError'
          ? 'Der Mikrofonzugriff wurde blockiert. Erlaube ihn in den Website-Einstellungen deines Browsers und versuche es erneut.'
          : name === 'NotFoundError'
            ? 'Es wurde kein Mikrofon gefunden.'
            : (err as Error).message,
      )
      setMicState('error')
      return false
    }
  }, [])

  // Re-open the mic when the device or the headphone mode (echo cancellation) changes.
  useEffect(() => {
    if (micState === 'on') void enableMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.micDeviceId, settings.headphones])

  useEffect(() => () => micRef.current?.close(), [])

  // Main loop: analyse audio, then move the score cursor.
  useEffect(() => {
    if (!engine) return
    let raf = 0
    let lastVisit = -1
    const loop = (now: number) => {
      engine.frame(now)
      const beat = engine.mode === 'play' ? engine.player.currentBeat() : (engine.notes[engine.waitIdx]?.startBeat ?? 0)
      const v = engine.timeline.visitAt(Math.max(0, beat))
      scoreRef.current?.setPosition(v.index, Math.max(0, beat) - v.startBeat)
      if (v.index !== lastVisit) {
        lastVisit = v.index
        setCurrentVisit(v.index)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])

  const toggle = useCallback(async () => {
    const e = engineRef.current
    if (!e) return
    await audioContext().resume()
    if (!micRef.current && !(await enableMic())) return
    e.toggle()
  }, [enableMic])

  // Pause and store the session when the tab is hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden' || !engineRef.current) return
      engineRef.current.pause()
      saveSession(engineRef.current)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [saveSession])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement
      if (t.closest('input, select, textarea, dialog[open]') || ev.metaKey || ev.ctrlKey) return
      const e = engineRef.current
      if (ev.code === 'Space') {
        ev.preventDefault()
        void toggle()
      } else if (ev.key === 'r' && e) e.playReference()
      else if (ev.key === 'ArrowRight' && e?.mode === 'wait') e.skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  const changeMode = (m: Mode) => {
    const e = engineRef.current
    if (!e || e.mode === m) return
    e.pause()
    saveSession(e)
    e.setMode(m)
  }

  const pickTrack = (id: string) => {
    setPickerOpen(false)
    setTrackId(id)
  }

  const loopMeasure = (mi: number) => {
    const e = engineRef.current
    if (!e) return
    setResults(null)
    const visit = e.timeline.visits.find((v) => v.measureIndex === mi)
    if (visit) e.setLoop({ startVisit: visit.index, endVisit: visit.index })
  }

  // Deep link from the progress page: loop the requested measure once the engine exists.
  const appliedInitialLoop = useRef(false)
  useEffect(() => {
    if (!engine || initialLoop === undefined || appliedInitialLoop.current) return
    appliedInitialLoop.current = true
    loopMeasure(initialLoop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, initialLoop])

  const seekVisit = (v: number) => engineRef.current?.seekToVisit(v)
  const getEngine = useCallback(() => engineRef.current, [])
  const getLive = useCallback(() => engineRef.current?.live ?? { sung: null, target: null, cents: null, inTune: false, levelDb: -100, blocked: false, beat: 0, hold: 0 }, [])

  if (song === null || parsed.error) {
    return (
      <div className="mx-auto max-w-lg px-6 pt-24 text-center">
        <p className="font-display text-2xl font-semibold">{song === null ? 'Dieses Stück gibt es nicht mehr.' : 'Die Partitur konnte nicht gelesen werden.'}</p>
        {parsed.error && <p className="mt-2 text-mist">{parsed.error}</p>}
        <a className="btn btn-primary mt-6" href={href.library()}>
          Zur Bibliothek
        </a>
      </div>
    )
  }

  const tracks = timeline?.tracks ?? []
  const ownTrack = timeline && trackId ? timeline.track(trackId) : null
  const ownPartIndex = score?.tracks.find((t) => t.id === trackId)?.partIndex ?? 0
  const mode = engine?.mode ?? 'play'

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:gap-3 sm:px-5">
        <a href={href.library()} className="icon-btn" aria-label="Zur Bibliothek">
          <ArrowLeft size={20} />
        </a>
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold sm:flex-none sm:text-xl">{song?.title ?? ''}</h1>
        {tracks.length > 0 && (
          <select
            className="max-w-36 sm:ml-2 sm:max-w-52"
            value={trackId ?? ''}
            onChange={(e) => pickTrack(e.target.value)}
            aria-label="Deine Stimme"
          >
            {!trackId && <option value="">Stimme wählen</option>}
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto hidden md:block">
          <Segmented<Mode>
            label="Übungsmodus"
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'play', label: <><Music2 size={15} /> Mitsingen</> },
              { value: 'wait', label: <><Hourglass size={15} /> Warten</> },
            ]}
          />
        </div>
        <div className="flex items-center md:ml-2">
          <button className="icon-btn" onClick={() => setMixerOpen(true)} aria-label="Mixer" title="Mixer">
            <SlidersHorizontal size={20} />
          </button>
          <a className="icon-btn" href={href.progress(songId)} aria-label="Fortschritt" title="Fortschritt">
            <BarChart3 size={20} />
          </a>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen" title="Einstellungen">
            <Settings2 size={20} />
          </button>
        </div>
      </header>
      <div className="flex justify-center px-3 pb-2 md:hidden">
        <Segmented<Mode>
          size="sm"
          label="Übungsmodus"
          value={mode}
          onChange={changeMode}
          options={[
            { value: 'play', label: 'Mitsingen' },
            { value: 'wait', label: 'Warten bis getroffen' },
          ]}
        />
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,0.95fr)_auto_minmax(0,1fr)] gap-2.5 px-2.5 pb-2.5 sm:gap-3 sm:px-4 sm:pb-3 lg:grid-cols-[minmax(0,1fr)_21rem] lg:grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-h-0 lg:col-start-1 lg:row-start-1">
          {song && score && (
            <ScoreView
              ref={scoreRef}
              xml={song.xml}
              ownPartIndex={ownPartIndex}
              showAllParts={compact ? settings.showAllPartsMobile : settings.showAllParts}
              zoom={zoom}
              onZoom={setZoom}
              onShowAllParts={(v) => settings.set(compact ? { showAllPartsMobile: v } : { showAllParts: v })}
              onLayout={onLayout}
              onMeasureClick={(mi) => {
                const e = engineRef.current
                if (!e) return
                const candidates = e.timeline.visits.filter((v) => v.measureIndex === mi)
                const next = candidates.find((v) => v.index >= currentVisit) ?? candidates[0]
                if (next) e.seekToVisit(next.index)
              }}
            />
          )}
        </div>

        <div className="min-h-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Tuner getLive={getLive} tolerance={settings.tolerance} naming={settings.naming} micOn={micState === 'on'} waitMode={mode === 'wait'} compact={compact} />
        </div>

        <div className="surface relative flex min-h-0 flex-col overflow-hidden lg:col-start-1 lg:row-start-2">
          <div className="min-h-0 flex-1">
            <PianoRoll getEngine={getEngine} tolerance={settings.tolerance} ignoreOctave={settings.ignoreOctave} naming={settings.naming} onSeekVisit={seekVisit} />
          </div>
          {ownTrack?.notes.some((n) => n.lyric) && <Lyrics getEngine={getEngine} />}

          {micState !== 'on' && trackId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 grid place-items-center bg-night/70 p-4 backdrop-blur-sm">
              <div className="max-w-md text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold/15 text-gold">
                  <MicIcon size={26} />
                </span>
                <p className="mt-3 font-display text-xl font-semibold">Mikrofon aktivieren, um zu starten</p>
                <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-mist">
                  <Headphones size={15} className="shrink-0" /> Mit Kopfhörern hört das Mikrofon nur dich.
                </p>
                {micError && <p className="mt-3 text-sm text-sharp">{micError}</p>}
                <button className="btn btn-primary mt-4" onClick={() => void enableMic()} disabled={micState === 'starting'}>
                  {micState === 'starting' ? 'Warte auf Freigabe …' : 'Mikrofon aktivieren'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {timeline && engine && (
        <TransportBar
          running={engine.running}
          mode={mode}
          visits={timeline.visits}
          currentVisit={currentVisit}
          loop={engine.loop}
          factor={factor}
          bpm={timeline.bpmAt(Math.max(0, engine.player.currentBeat()))}
          metronome={settings.metronome}
          onToggle={() => void toggle()}
          onRestart={() => engine.seekToVisit(engine.loop?.startVisit ?? 0)}
          onFactor={(f) => {
            setFactor(f)
            engine.player.setFactor(f)
          }}
          onLoop={(l) => engine.setLoop(l)}
          onMetronome={(v) => settings.set({ metronome: v })}
          onReference={() => engine.playReference()}
          onSkip={() => engine.skip()}
        />
      )}

      <TrackPicker
        open={pickerOpen && tracks.length > 0}
        tracks={tracks}
        current={trackId ?? undefined}
        onPick={pickTrack}
        onClose={() => {
          setPickerOpen(false)
          if (!trackId && tracks[0]) pickTrack(tracks[0].id)
        }}
      />
      {trackId && <MixerDialog open={mixerOpen} onClose={() => setMixerOpen(false)} tracks={tracks} ownId={trackId} mixer={mixer} onChange={setMixer} />}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} micLabel={micState} />
      <ResultsDialog open={!!results} onClose={() => setResults(null)} session={results?.session ?? null} previous={results?.previous ?? null} onLoopMeasure={loopMeasure} />
    </div>
  )
}

/** The sung text around the current note, with the current syllable highlighted. */
function Lyrics({ getEngine }: { getEngine: () => PracticeEngine | null }) {
  const [idx, setIdx] = useState(-1)
  useEffect(() => {
    let raf = 0
    let last = -2
    const loop = () => {
      const e = getEngine()
      const i = e ? (e.mode === 'wait' ? e.waitIdx : (e.live.target?.idx ?? -1)) : -1
      if (i !== last) {
        last = i
        if (i >= 0) setIdx(i)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [getEngine])

  const e = getEngine()
  if (!e) return null
  const withLyrics = e.notes.filter((n) => n.lyric)
  const anchor = idx < 0 ? 0 : withLyrics.findIndex((n) => n.idx >= idx)
  const pos = anchor < 0 ? withLyrics.length - 1 : anchor
  const slice = withLyrics.slice(Math.max(0, pos - 4), pos + 10)
  const activeIdx = idx >= 0 && e.notes[idx]?.lyric ? idx : -1

  return (
    <p className="truncate border-t border-white/7 px-4 py-2.5 text-center font-display text-lg sm:text-xl" aria-live="off">
      {slice.map((n) => (
        <span key={n.idx} className={`transition-colors duration-150 ${n.idx === activeIdx ? 'text-gold' : n.idx < idx ? 'text-dim' : 'text-mist'}`}>
          {n.lyric}
          {n.lyricJoin ? '' : ' '}
        </span>
      ))}
    </p>
  )
}
