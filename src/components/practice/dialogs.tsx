import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Mic, Repeat, Target, TrendingDown, TrendingUp, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { href } from '../../App'
import type { Channel } from '../../lib/audio/player'
import { listMics } from '../../lib/audio/mic'
import type { SessionRecord } from '../../lib/db'
import { noteName } from '../../lib/music'
import type { TTrack } from '../../lib/timeline'
import { useSettings, type Sensitivity } from '../../store/settings'
import { Dialog, Segmented, Slider, Switch } from '../ui'

export function TrackPicker({ open, tracks, current, onPick, onClose }: { open: boolean; tracks: TTrack[]; current?: string; onPick: (id: string) => void; onClose: () => void }) {
  const naming = useSettings((s) => s.naming)
  return (
    <Dialog open={open} onClose={onClose} title="Welche Stimme singst du?">
      <p className="-mt-1 mb-4 text-mist">Du kannst die Stimme jederzeit oben wechseln.</p>
      <ul className="grid gap-2">
        {tracks.map((t, i) => (
          <motion.li key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <button
              onClick={() => onPick(t.id)}
              className={`flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors ${t.id === current ? 'bg-gold/15 shadow-[inset_0_0_0_1px_rgb(242_211_166/0.5)]' : 'bg-white/5 hover:bg-white/9'}`}
            >
              <span className="font-display text-lg font-semibold">{t.name}</span>
              <span className="tabular text-sm text-mist">
                {noteName(t.low, naming)} bis {noteName(t.high, naming)}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </Dialog>
  )
}

const PRESETS: { id: string; label: string; hint: string; own: Partial<Channel>; others: Partial<Channel> }[] = [
  { id: 'learn', label: 'Lernen', hint: 'Deine Stimme laut, die anderen leise', own: { volume: 0.95, muted: false }, others: { volume: 0.45, muted: false } },
  { id: 'firm', label: 'Festigen', hint: 'Deine Stimme leise als Stütze', own: { volume: 0.35, muted: false }, others: { volume: 0.85, muted: false } },
  { id: 'alone', label: 'Allein', hint: 'Nur die anderen, du singst deine Stimme', own: { muted: true }, others: { volume: 0.85, muted: false } },
  { id: 'solo', label: 'Nur meine', hint: 'Nur deine Stimme', own: { volume: 0.95, muted: false }, others: { muted: true } },
]

export function presetMix(tracks: TTrack[], ownId: string, presetId = 'learn') {
  const p = PRESETS.find((x) => x.id === presetId)!
  return Object.fromEntries(
    tracks.map((t) => [t.id, { volume: 0.8, muted: false, solo: false, ...(t.id === ownId ? p.own : p.others) } satisfies Channel]),
  )
}

function sameMix(a: Record<string, Channel>, b: Record<string, Channel>) {
  return Object.keys(a).every((k) => b[k] && Math.abs(a[k].volume - b[k].volume) < 0.005 && a[k].muted === b[k].muted && a[k].solo === b[k].solo)
}

export function MixerDialog({
  open,
  onClose,
  tracks,
  ownId,
  mixer,
  onChange,
}: {
  open: boolean
  onClose: () => void
  tracks: TTrack[]
  ownId: string
  mixer: Record<string, Channel>
  onChange: (m: Record<string, Channel>) => void
}) {
  const set = (id: string, patch: Partial<Channel>) => onChange({ ...mixer, [id]: { ...mixer[id], ...patch } })
  const ordered = [...tracks].sort((a, b) => Number(b.id === ownId) - Number(a.id === ownId))
  const active = PRESETS.find((p) => sameMix(presetMix(tracks, ownId, p.id), mixer)) ?? null
  return (
    <Dialog open={open} onClose={onClose} title="Mixer">
      <Segmented
        stretch
        label="Voreinstellung"
        value={active?.id ?? null}
        onChange={(id) => onChange(presetMix(tracks, ownId, id))}
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
      />
      <p className="mt-2 text-sm text-mist">{active ? active.hint : 'Eigene Mischung'}</p>
      <ul className="mt-5 grid gap-1">
        {ordered.map((t) => {
          const ch = mixer[t.id] ?? { volume: 0.8, muted: false, solo: false }
          const own = t.id === ownId
          return (
            <li key={t.id} className={`rounded-2xl px-3 py-2.5 ${own ? 'bg-gold/10' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {t.name}
                  {own && <span className="ml-2 text-xs font-semibold text-gold">deine Stimme</span>}
                </span>
                <button className="icon-btn size-9" aria-pressed={ch.muted} aria-label={`${t.name} stummschalten`} onClick={() => set(t.id, { muted: !ch.muted })}>
                  {ch.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button className="icon-btn size-9 text-sm font-bold" aria-pressed={ch.solo} aria-label={`${t.name} solo`} onClick={() => set(t.id, { solo: !ch.solo })}>
                  S
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={ch.volume}
                aria-label={`Lautstärke ${t.name}`}
                onChange={(e) => set(t.id, { volume: Number(e.target.value), muted: false })}
                style={{ opacity: ch.muted ? 0.4 : 1 }}
              />
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}

export function SettingsDialog({ open, onClose, micLabel }: { open: boolean; onClose: () => void; micLabel: string }) {
  const s = useSettings()
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    if (open) listMics().then(setMics, () => setMics([]))
  }, [open, micLabel])

  return (
    <Dialog open={open} onClose={onClose} title="Einstellungen">
      <h3 className="mt-1 flex items-center gap-2 text-sm font-semibold text-gold">
        <Mic size={15} /> Mikrofon
      </h3>
      {mics.length > 0 && mics.some((m) => m.label) ? (
        <select className="mt-2 w-full" value={s.micDeviceId ?? ''} onChange={(e) => s.set({ micDeviceId: e.target.value || null })} aria-label="Mikrofon">
          <option value="">Standard-Mikrofon</option>
          {mics.map((m) => (
            <option key={m.deviceId} value={m.deviceId}>
              {m.label || 'Mikrofon'}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-2 text-sm text-mist">Aktiviere das Mikrofon, um eines auszuwählen.</p>
      )}
      <Switch
        checked={s.headphones}
        onChange={(v) => s.set({ headphones: v })}
        label="Ich nutze Kopfhörer"
        hint={s.headphones ? 'Beste Erkennung.' : 'Ohne Kopfhörer werden Töne der Begleitung herausgefiltert und Echo-Unterdrückung aktiviert.'}
      />
      <div className="py-2.5">
        <span className="block font-semibold">Erkennung</span>
        <span className="mt-0.5 mb-2 block text-sm text-mist">„Tolerant“ hilft bei leiser oder behauchter Stimme, „Streng“ in lauter Umgebung.</span>
        <Segmented<Sensitivity>
          label="Erkennung"
          value={s.sensitivity}
          onChange={(v) => s.set({ sensitivity: v })}
          options={[
            { value: 'tolerant', label: 'Tolerant' },
            { value: 'normal', label: 'Normal' },
            { value: 'strict', label: 'Streng' },
          ]}
        />
      </div>

      <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-gold">
        <Target size={15} /> Bewertung
      </h3>
      <Slider
        label="Toleranz"
        value={s.tolerance}
        min={10}
        max={50}
        step={5}
        onChange={(v) => s.set({ tolerance: v })}
        format={(v) => `± ${v} Cent`}
        hint="So weit darfst du neben dem Ton liegen, damit er als getroffen gilt. 100 Cent sind ein Halbton."
      />
      <Switch checked={s.ignoreOctave} onChange={(v) => s.set({ ignoreOctave: v })} label="Oktave egal" hint="Praktisch, wenn du eine Stimme in einer anderen Lage übst." />

      <h3 className="mt-5 text-sm font-semibold text-gold">Üben</h3>
      <Switch checked={s.countIn} onChange={(v) => s.set({ countIn: v })} label="Einzählen" hint="Ein Takt Klicks vor dem Mitsingen." />
      <Switch checked={s.refTone} onChange={(v) => s.set({ refTone: v })} label="Ton vorspielen im Warte-Modus" hint="Spielt jede neue Note kurz an." />
      <div className="flex items-center justify-between gap-4 py-2.5">
        <span className="font-semibold">Notennamen</span>
        <Segmented
          size="sm"
          label="Notennamen"
          value={s.naming}
          onChange={(v) => s.set({ naming: v })}
          options={[
            { value: 'de', label: 'C D E … H' },
            { value: 'intl', label: 'C D E … B' },
          ]}
        />
      </div>
      <Slider label="Kammerton A4" value={s.a4} min={430} max={446} onChange={(v) => s.set({ a4: v })} format={(v) => `${v} Hz`} />
    </Dialog>
  )
}

const pct = (v: number) => `${Math.round(v * 100)} %`

export function accColor(acc: number) {
  if (acc >= 0.85) return '#6ef0c2'
  if (acc >= 0.6) return '#f2d3a6'
  return '#ff9f5a'
}

export function ResultsDialog({
  open,
  onClose,
  session,
  previous,
  onLoopMeasure,
}: {
  open: boolean
  onClose: () => void
  session: SessionRecord | null
  previous: SessionRecord | null
  onLoopMeasure: (measureIndex: number) => void
}) {
  if (!session) return <Dialog open={false} onClose={onClose} title="" children={null} />
  const measures = Object.entries(session.measures)
    .map(([k, m]) => ({ mi: Number(k), ...m, acc: m.n ? m.score / m.n : 0 }))
    .sort((a, b) => a.mi - b.mi)
  const problems = [...measures].filter((m) => m.acc < 0.7).sort((a, b) => a.acc - b.acc).slice(0, 4)
  const delta = previous && previous.notes ? session.accuracy - previous.accuracy : null

  return (
    <Dialog open={open} onClose={onClose} title="Auswertung" wide>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <motion.p
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="tabular font-display text-6xl font-semibold"
            style={{ color: accColor(session.accuracy) }}
          >
            {pct(session.accuracy)}
          </motion.p>
          <p className="text-mist">
            der Noten getroffen ({session.notes} bewertet, {session.trackName})
          </p>
        </div>
        {delta !== null && (
          <p className={`flex items-center gap-1.5 font-semibold ${delta >= 0 ? 'text-tune' : 'text-sharp'}`}>
            {delta >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {delta >= 0 ? '+' : '−'}
            {Math.abs(Math.round(delta * 100))} Punkte zum letzten Mal
          </p>
        )}
      </div>

      {measures.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-semibold text-mist">Takt für Takt</h3>
          <div className="flex flex-wrap gap-1">
            {measures.map((m, i) => (
              <motion.button
                key={m.mi}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.012 }}
                onClick={() => onLoopMeasure(m.mi)}
                className="tabular grid h-9 min-w-9 place-items-center rounded-lg px-1 text-xs font-bold text-night"
                style={{ background: accColor(m.acc) }}
                title={`Takt ${m.label}: ${pct(m.acc)}. Klicken zum Üben.`}
              >
                {m.label}
              </motion.button>
            ))}
          </div>
        </>
      )}

      {problems.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-semibold text-mist">Hier lohnt sich Üben</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {problems.map((m) => {
              const bias = m.biasN ? m.biasSum / m.biasN : 0
              return (
                <li key={m.mi} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <span>
                    <span className="font-semibold">Takt {m.label}</span>
                    <span className="ml-2 tabular text-sm" style={{ color: accColor(m.acc) }}>
                      {pct(m.acc)}
                    </span>
                    {Math.abs(bias) > 12 && (
                      <span className="mt-0.5 flex items-center gap-1 text-sm text-mist">
                        {bias < 0 ? <ArrowUp size={14} className="text-flat" /> : <ArrowDown size={14} className="text-sharp" />}
                        meist {bias < 0 ? 'zu tief' : 'zu hoch'} (Ø {Math.round(Math.abs(bias))} Cent)
                      </span>
                    )}
                    {m.silent > m.n / 2 && <span className="mt-0.5 block text-sm text-mist">oft nicht gesungen</span>}
                  </span>
                  <button className="btn btn-quiet px-3" onClick={() => onLoopMeasure(m.mi)}>
                    <Repeat size={16} /> Üben
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <a className="btn btn-quiet" href={href.progress(session.songId)}>
          Fortschritt über Zeit
        </a>
        <button className="btn btn-primary" onClick={onClose}>
          Weiter üben
        </button>
      </div>
    </Dialog>
  )
}
