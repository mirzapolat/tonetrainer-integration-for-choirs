import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, EllipsisVertical, FileMusic, Play, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { href } from '../../App'
import { db, type SessionRecord, type SongRecord } from '../../lib/db'
import { demoScoreXml } from '../../lib/demo'
import { readScoreFile } from '../../lib/musicxml/load'
import { parseScore } from '../../lib/musicxml/parse'
import { noteName } from '../../lib/music'
import { useSettings } from '../../store/settings'
import { Logo } from '../ui'
import PracticeChart from './PracticeChart'

async function importXml(xml: string, fileName: string) {
  const score = parseScore(xml)
  const song: SongRecord = {
    id: crypto.randomUUID(),
    title: score.title,
    composer: score.composer,
    fileName,
    xml,
    addedAt: Date.now(),
    tracks: score.tracks.map((t) => {
      const pitches = t.notes.map((n) => n.midi)
      return { id: t.id, name: t.name, low: Math.min(...pitches), high: Math.max(...pitches), noteCount: t.notes.length }
    }),
    prefs: {},
  }
  await db.putSong(song)
  return song
}

const rtf = new Intl.RelativeTimeFormat('de', { numeric: 'auto' })
function relative(ts: number) {
  const days = Math.round((startOfDay(ts) - startOfDay(Date.now())) / 86_400_000)
  if (days === 0) return 'heute'
  if (days > -7) return rtf.format(days, 'day')
  return new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}
function startOfDay(ts: number) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export default function Library() {
  const [songs, setSongs] = useState<SongRecord[] | null>(null)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const naming = useSettings((s) => s.naming)

  const reload = useCallback(async () => {
    const [s, ss] = await Promise.all([db.songs(), db.sessions()])
    setSongs(s)
    setSessions(ss)
  }, [])
  useEffect(() => {
    reload()
  }, [reload])

  const handleFiles = useCallback(async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const song = await importXml(await readScoreFile(file), file.name)
      location.hash = href.practice(song.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Die Datei konnte nicht gelesen werden.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    let depth = 0
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      depth++
      setDragging(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      handleFiles(e.dataTransfer?.files ?? null)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [handleFiles])

  const openDemo = async () => {
    const song = await importXml(demoScoreXml(), 'abendlied-demo.musicxml')
    location.hash = href.practice(song.id)
  }

  const remove = async (song: SongRecord) => {
    if (!confirm(`„${song.title}“ und alle Übungsdaten dazu löschen?`)) return
    await db.deleteSong(song.id)
    reload()
  }

  const lastSession = (songId: string) => [...sessions].reverse().find((s) => s.songId === songId)
  const empty = songs !== null && songs.length === 0

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-16 sm:px-8">
      <input ref={fileRef} type="file" accept=".musicxml,.xml,.mxl" hidden onChange={(e) => handleFiles(e.target.files)} />

      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-xl font-semibold tracking-tight">Tonetrainer</span>
        </div>
        {!empty && (
          <button className="btn btn-quiet" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={18} />
            <span className="hidden sm:inline">Partitur hochladen</span>
          </button>
        )}
      </header>

      <h1 className="mt-10 font-display text-3xl font-semibold tracking-tight">Deine Stücke</h1>

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-sharp/12 px-4 py-3 text-sm text-sharp shadow-[inset_0_0_0_1px_rgb(255_159_90/0.3)]">
          {error}
        </p>
      )}

      {empty ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="surface flex items-center gap-4 p-5 text-left transition-shadow hover:shadow-[inset_0_0_0_1px_rgb(242_211_166/0.5)]"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-gold/15 text-gold">
              <Upload size={22} />
            </span>
            <span className="font-display text-lg font-semibold">Partitur hochladen</span>
          </button>
          <button onClick={openDemo} className="surface flex items-center gap-4 p-5 text-left transition-shadow hover:shadow-[inset_0_0_0_1px_rgb(201_200_245/0.4)]">
            <span className="grid size-11 place-items-center rounded-xl bg-lavender/12 text-lavender">
              <FileMusic size={22} />
            </span>
            <span className="font-display text-lg font-semibold">Demo öffnen</span>
          </button>
        </section>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <section aria-label="Deine Stücke">
            <ul className="surface divide-y divide-white/7 overflow-hidden">
              {songs?.map((song, i) => {
                const last = lastSession(song.id)
                return (
                  <motion.li
                    key={song.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 px-5 py-4 sm:px-6"
                  >
                    <a href={href.practice(song.id)} className="min-w-0 flex-1 rounded-lg">
                      <span className="block truncate font-display text-lg font-semibold">{song.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mist">
                        {song.composer && <span className="truncate">{song.composer}</span>}
                        <span>
                          {song.tracks.length} {song.tracks.length === 1 ? 'Stimme' : 'Stimmen'}
                        </span>
                        {last ? (
                          <span>
                            {relative(last.endedAt)} geübt: {last.trackName}
                            {last.notes > 0 && <span className="text-gold"> {Math.round(last.accuracy * 100)} %</span>}
                          </span>
                        ) : (
                          <span className="text-dim">noch nicht geübt</span>
                        )}
                      </span>
                      <span className="mt-2 hidden flex-wrap gap-1.5 sm:flex">
                        {song.tracks.map((t) => (
                          <span key={t.id} className="rounded-md bg-white/6 px-2 py-0.5 text-xs text-mist">
                            {t.name} <span className="text-dim">{noteName(t.low, naming)}–{noteName(t.high, naming)}</span>
                          </span>
                        ))}
                      </span>
                    </a>
                    <a href={href.practice(song.id)} className="btn btn-primary" aria-label={`${song.title} üben`}>
                      <Play size={16} fill="currentColor" />
                      <span className="hidden sm:inline">Üben</span>
                    </a>
                    <button className="icon-btn" popoverTarget={`menu-${song.id}`} aria-label="Weitere Aktionen">
                      <EllipsisVertical size={18} />
                    </button>
                    <div
                      id={`menu-${song.id}`}
                      popover="auto"
                      className="menu-popover min-w-52 rounded-xl bg-raised p-1.5 text-chalk shadow-2xl shadow-black/50"
                    >
                      <a href={href.progress(song.id)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/8">
                        <BarChart3 size={16} /> Fortschritt ansehen
                      </a>
                      <button onClick={() => remove(song)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-sharp hover:bg-white/8">
                        <Trash2 size={16} /> Stück löschen
                      </button>
                    </div>
                  </motion.li>
                )
              })}
            </ul>
          </section>
          <PracticeChart sessions={sessions} />
        </div>
      )}

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-3xl border-2 border-dashed border-gold/70 bg-night/80 backdrop-blur-sm"
          >
            <p className="font-display text-3xl font-semibold text-gold">Partitur hier ablegen</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
