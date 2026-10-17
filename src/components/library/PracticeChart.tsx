import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SessionRecord } from '../../lib/db'
import { formatMinutes, practiceBuckets, streak, type Range } from '../../lib/stats'
import { Segmented } from '../ui'

const CURRENT_LABEL: Record<Range, string> = { day: 'heute', week: 'diese Woche', month: 'diesen Monat' }

export default function PracticeChart({ sessions }: { sessions: SessionRecord[] }) {
  const [range, setRange] = useState<Range>('day')
  const buckets = useMemo(() => practiceBuckets(sessions, range), [sessions, range])
  const days = useMemo(() => streak(sessions), [sessions])
  const max = Math.max(10, ...buckets.map((b) => b.minutes))
  const current = buckets[buckets.length - 1]

  return (
    <section aria-label="Übungszeit" className="surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Übungszeit</h2>
        <Segmented
          size="sm"
          label="Zeitraum"
          value={range}
          onChange={setRange}
          options={[
            { value: 'day', label: 'Tag' },
            { value: 'week', label: 'Woche' },
            { value: 'month', label: 'Monat' },
          ]}
        />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <p>
          <span className="tabular font-display text-3xl font-semibold">{formatMinutes(current.minutes)}</span>
          <span className="ml-2 text-sm text-mist">{CURRENT_LABEL[range]}</span>
        </p>
        {days > 0 && (
          <p className="flex items-center gap-1 text-sm font-semibold text-glow" title="Tage in Folge geübt">
            <Flame size={16} /> {days} {days === 1 ? 'Tag' : 'Tage'}
          </p>
        )}
      </div>

      <div className="mt-5 flex h-32 items-end gap-1.5" role="img" aria-label={`Übungsminuten ${CURRENT_LABEL[range]} und davor`}>
        {buckets.map((b, i) => (
          <div key={b.key} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${b.title}: ${formatMinutes(b.minutes)}`}>
            <motion.div
              className={`w-full rounded-md ${b.current ? 'bg-gradient-to-t from-glow to-gold' : 'bg-gradient-to-t from-violet/70 to-lavender/70 group-hover:to-lavender'}`}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(b.minutes > 0 ? 4 : 1.5, (b.minutes / max) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 220, damping: 26, delay: i * 0.015 }}
              style={{ opacity: b.minutes > 0 ? 1 : 0.25 }}
            />
            <span className={`text-[10px] leading-none ${b.current ? 'font-bold text-gold' : 'text-dim'}`}>{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
