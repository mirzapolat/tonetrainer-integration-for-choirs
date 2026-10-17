import { motion } from 'framer-motion'
import { ArrowDown, ArrowLeft, ArrowUp, Play, Repeat, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { href } from '../App'
import { db, type SessionRecord, type SongRecord } from '../lib/db'
import { formatMinutes, measureTrends, type MeasureTrend } from '../lib/stats'
import { accColor } from './practice/dialogs'

const MAX_SESSIONS = 14

/** Date of a session, or its time when all shown sessions happened on the same day. */
function sessionLabel(s: SessionRecord, all: SessionRecord[]) {
  const day = (t: number) => new Date(t).toDateString()
  const sameDay = all.every((x) => day(x.startedAt) === day(all[0].startedAt))
  return sameDay
    ? new Date(s.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : new Date(s.startedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })
}

export default function SongProgress({ songId }: { songId: string }) {
  const [song, setSong] = useState<SongRecord | null | undefined>(undefined)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [trackId, setTrackId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([db.song(songId), db.sessions(songId)]).then(([s, ss]) => {
      setSong(s ?? null)
      setSessions(ss)
      setTrackId(ss.filter((x) => x.notes > 0).at(-1)?.trackId ?? s?.prefs.trackId ?? null)
    })
  }, [songId])

  const graded = useMemo(() => sessions.filter((s) => s.trackId === trackId && s.notes > 0).slice(-MAX_SESSIONS), [sessions, trackId])
  const trends = useMemo(() => measureTrends(graded), [graded])
  const practicedTracks = useMemo(() => [...new Map(sessions.map((s) => [s.trackId, s.trackName])).entries()], [sessions])
  const totalMin = sessions.reduce((a, s) => a + s.practiceSec / 60, 0)

  if (song === undefined) return null
  if (song === null) {
    return (
      <div className="px-6 pt-24 text-center">
        <p className="font-display text-2xl font-semibold">Dieses Stück gibt es nicht mehr.</p>
        <a className="btn btn-primary mt-6" href={href.library()}>
          Zur Bibliothek
        </a>
      </div>
    )
  }

  const persistent = trends.filter((t) => t.status === 'persistent')
  const improved = trends.filter((t) => t.status === 'improved')
  const declined = trends.filter((t) => t.status === 'declined')
  const latest = graded.at(-1)
  const best = graded.reduce((a, s) => Math.max(a, s.accuracy), 0)

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-16 sm:px-8">
      <header className="flex flex-wrap items-center gap-3">
        <a href={href.library()} className="icon-btn -ml-2" aria-label="Zur Bibliothek">
          <ArrowLeft size={20} />
        </a>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight">{song.title}</h1>
          <p className="text-mist">Fortschritt</p>
        </div>
        {practicedTracks.length > 1 && (
          <select value={trackId ?? ''} onChange={(e) => setTrackId(e.target.value)} aria-label="Stimme">
            {practicedTracks.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        <a href={href.practice(songId)} className="btn btn-primary">
          <Play size={16} fill="currentColor" /> Üben
        </a>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Geübt insgesamt', formatMinutes(totalMin)],
          ['Durchgänge', String(graded.length)],
          ['Zuletzt', latest ? `${Math.round(latest.accuracy * 100)} %` : '–'],
          ['Bestwert', graded.length ? `${Math.round(best * 100)} %` : '–'],
        ].map(([k, v]) => (
          <div key={k} className="surface px-5 py-4">
            <dt className="text-sm text-mist">{k}</dt>
            <dd className="tabular mt-1 font-display text-2xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {graded.length === 0 ? (
        <p className="surface mt-6 p-6 text-mist">Für diese Stimme gibt es noch keine bewerteten Durchgänge. Sing das Stück einmal mit, dann siehst du hier, wie du dich entwickelst.</p>
      ) : (
        <>
          <section className="surface mt-6 p-5" aria-label="Genauigkeit pro Durchgang">
            <h2 className="font-display text-lg font-semibold">Genauigkeit pro Durchgang</h2>
            <AccuracyChart sessions={graded} />
          </section>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <TrendList title="Hartnäckig" icon={<Repeat size={16} />} tone="text-sharp" items={persistent} songId={songId} empty="Keine Stelle, die immer wieder schiefgeht." />
            <TrendList
              title="Besser geworden"
              icon={<TrendingUp size={16} />}
              tone="text-tune"
              items={improved}
              songId={songId}
              empty={graded.length < 2 ? 'Nach dem zweiten Durchgang siehst du hier, welche Takte besser geworden sind.' : 'Noch keine deutliche Verbesserung messbar.'}
            />
            <TrendList title="Nachgelassen" icon={<TrendingDown size={16} />} tone="text-flat" items={declined} songId={songId} empty="Nichts ist schlechter geworden." />
          </div>

          <section className="surface mt-6 p-5" aria-label="Takte über die Durchgänge">
            <h2 className="font-display text-lg font-semibold">Takt für Takt über die Zeit</h2>
            <p className="mt-1 text-sm text-mist">Jede Zeile ist ein Durchgang, der neueste unten. Klick auf einen Takt, um ihn in Schleife zu üben.</p>
            <Heatmap sessions={graded} trends={trends} songId={songId} />
          </section>
        </>
      )}
    </div>
  )
}

function AccuracyChart({ sessions }: { sessions: SessionRecord[] }) {
  const W = 640
  const H = 160
  const pad = { l: 34, r: 12, t: 12, b: 24 }
  const xs = (i: number) => pad.l + (sessions.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (sessions.length - 1)) * (W - pad.l - pad.r))
  const ys = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b)
  const d = sessions.map((s, i) => `${i ? 'L' : 'M'} ${xs(i)} ${ys(s.accuracy)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Genauigkeit von ${Math.round(sessions[0].accuracy * 100)} % bis ${Math.round(sessions.at(-1)!.accuracy * 100)} %`}>
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={ys(v)} y2={ys(v)} stroke="rgb(255 255 255 / 0.07)" />
          <text x={pad.l - 6} y={ys(v) + 4} textAnchor="end" fontSize="10" fill="#6f78b5">
            {v * 100}%
          </text>
        </g>
      ))}
      <motion.path d={d} fill="none" stroke="url(#acc)" strokeWidth={2.5} strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
      <defs>
        <linearGradient id="acc" x1="0" x2="1">
          <stop offset="0" stopColor="#3fd0ff" />
          <stop offset="1" stopColor="#f2d3a6" />
        </linearGradient>
      </defs>
      {sessions.map((s, i) => (
        <g key={s.id}>
          <circle cx={xs(i)} cy={ys(s.accuracy)} r={4.5} fill={accColor(s.accuracy)}>
            <title>{`${new Date(s.startedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}: ${Math.round(s.accuracy * 100)} % (${s.mode === 'wait' ? 'Warte-Modus' : `Mitsingen, ${Math.round(s.tempoFactor * 100)} % Tempo`})`}</title>
          </circle>
          <text x={xs(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#6f78b5">
            {sessionLabel(s, sessions)}
          </text>
        </g>
      ))}
    </svg>
  )
}

function TrendList({ title, icon, tone, items, songId, empty }: { title: string; icon: React.ReactNode; tone: string; items: MeasureTrend[]; songId: string; empty: string }) {
  return (
    <section className="surface p-5">
      <h2 className={`flex items-center gap-2 font-display text-lg font-semibold ${tone}`}>
        {icon} {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-mist">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-1.5">
          {items.slice(0, 8).map((t) => (
            <li key={t.measureIndex}>
              <a href={href.practiceMeasure(songId, t.measureIndex)} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 hover:bg-white/9">
                <span>
                  <span className="font-semibold">Takt {t.label}</span>
                  {t.bias !== null && Math.abs(t.bias) > 12 && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-mist">
                      {t.bias < 0 ? <ArrowUp size={12} className="text-flat" /> : <ArrowDown size={12} className="text-sharp" />}
                      meist {t.bias < 0 ? 'zu tief' : 'zu hoch'}
                    </span>
                  )}
                </span>
                <span className="tabular text-sm text-mist">
                  {t.values
                    .filter((v): v is number => v !== null)
                    .slice(-3)
                    .map((v) => `${Math.round(v * 100)}`)
                    .join(' → ')}{' '}
                  %
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Heatmap({ sessions, trends, songId }: { sessions: SessionRecord[]; trends: MeasureTrend[]; songId: string }) {
  return (
    <div className="mt-4 overflow-x-auto pb-2">
      <table className="border-separate border-spacing-[3px]">
        <thead>
          <tr>
            <th />

            {trends.map((t) => (
              <th key={t.measureIndex} scope="col" className="tabular min-w-6 text-[10px] font-semibold text-dim">
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, row) => (
            <tr key={s.id}>
              <th scope="row" className="tabular sticky left-0 z-10 bg-panel pr-2 text-right text-[11px] font-semibold whitespace-nowrap text-mist">
                {sessionLabel(s, sessions)}
              </th>
              {trends.map((t, col) => {
                const v = t.values[row]
                return (
                  <td key={t.measureIndex} className="p-0">
                    <motion.a
                      href={href.practiceMeasure(songId, t.measureIndex)}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(0.6, (row * trends.length + col) * 0.003) }}
                      className="block size-6 rounded-md"
                      style={{ background: v === null ? 'rgb(255 255 255 / 0.05)' : accColor(v), opacity: v === null ? 1 : 0.35 + v * 0.65 }}
                      title={v === null ? `Takt ${t.label}: nicht gesungen` : `Takt ${t.label}: ${Math.round(v * 100)} %`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
