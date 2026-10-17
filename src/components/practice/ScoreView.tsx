import { Minus, Plus, User, Users } from 'lucide-react'
import { OpenSheetMusicDisplay, type Cursor } from 'opensheetmusicdisplay'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'

type Iter = Cursor['iterator']

interface Step {
  offsetQ: number
  iter: Iter
}

export interface ScoreHandle {
  /** Moves the cursor to the entry at (or just before) `offsetQ` within the given visit. */
  setPosition(visit: number, offsetQ: number): void
  colorNote(partIndex: number, voice: string, measureIndex: number, offsetQ: number, color: string | null): void
}

interface Props {
  ref: Ref<ScoreHandle>
  xml: string
  ownPartIndex: number
  showAllParts: boolean
  zoom: number
  onZoom: (z: number) => void
  onShowAllParts: (v: boolean) => void
  /** Called after each render; `order` is the measure play order including repeats and voltas. */
  onLayout: (order: number[]) => void
  onMeasureClick: (measureIndex: number) => void
}

const INK = '#161b3d'
const OTHER = '#9aa0c4'
const key = (pi: number, voice: string, mi: number, off: number) => `${pi}:${voice}:${mi}:${off.toFixed(3)}`

export default function ScoreView({ ref, xml, ownPartIndex, showAllParts, zoom, onZoom, onShowAllParts, onLayout, onMeasureClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const visitsRef = useRef<Step[][]>([])
  const notesRef = useRef(new Map<string, SVGGElement[]>())
  const colorsRef = useRef(new Map<string, string>())
  const lastStep = useRef<Step | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const propsRef = useRef({ ownPartIndex, showAllParts, onLayout })
  propsRef.current = { ownPartIndex, showAllParts, onLayout }

  const paint = (k: string, color: string) => {
    for (const g of notesRef.current.get(k) ?? []) {
      for (const p of g.querySelectorAll('path')) {
        p.setAttribute('fill', color)
        p.setAttribute('stroke', color)
      }
    }
  }

  const baseColor = (k: string) => (Number(k.split(':')[0]) === propsRef.current.ownPartIndex || !propsRef.current.showAllParts ? INK : OTHER)

  /** Walks the whole score once with OSMD's iterator (which follows repeats) to map time → cursor and notes → SVG. */
  const layout = () => {
    const osmd = osmdRef.current
    if (!osmd) return
    const cursor = osmd.cursor
    const sheet = osmd.Sheet
    cursor.reset()
    const it = cursor.iterator
    const visits: Step[][] = []
    const notes = new Map<string, SVGGElement[]>()
    const seen = new Set<number>()
    let prevMi = -1
    let prevTs = -1
    let firstVisitOfMeasure = false
    for (let guard = 0; !it.EndReached && guard < 100_000; guard++) {
      const mi = it.CurrentMeasureIndex
      const ts = it.currentTimeStamp.RealValue * 4
      if (mi !== prevMi || ts < prevTs - 1e-6) {
        visits.push([])
        firstVisitOfMeasure = !seen.has(mi)
        seen.add(mi)
      }
      const offsetQ = ts - sheet.SourceMeasures[mi].AbsoluteTimestamp.RealValue * 4
      visits[visits.length - 1].push({ offsetQ, iter: it.clone() })
      if (firstVisitOfMeasure) {
        for (const gn of cursor.GNotesUnderCursor()) {
          const src = gn.sourceNote
          if (!src || src.isRest()) continue
          const pi = sheet.Instruments.indexOf(src.ParentStaff.ParentInstrument)
          const voice = String(src.ParentVoiceEntry.ParentVoice.VoiceId)
          const el = (gn as unknown as { getSVGGElement?: () => SVGGElement }).getSVGGElement?.()
          if (!el) continue
          for (const k of [key(pi, voice, mi, offsetQ), key(pi, '*', mi, offsetQ)]) {
            if (!notes.has(k)) notes.set(k, [])
            if (!notes.get(k)!.includes(el)) notes.get(k)!.push(el)
          }
        }
      }
      prevMi = mi
      prevTs = ts
      it.moveToNext()
    }
    cursor.reset()
    cursor.show()
    visitsRef.current = visits
    notesRef.current = notes
    lastStep.current = null
    for (const k of notes.keys()) if (k.includes(':*:')) paint(k, baseColor(k))
    for (const [k, c] of colorsRef.current) paint(k, c)
    propsRef.current.onLayout(visits.map((v, i) => (v.length ? visits[i][0].iter.CurrentMeasureIndex : 0)))
  }

  const rerender = () => {
    const osmd = osmdRef.current
    if (!osmd) return
    setRendering(true)
    // Let the spinner paint before OSMD blocks the main thread.
    requestAnimationFrame(() =>
      setTimeout(() => {
        try {
          osmd.Sheet.Instruments.forEach((inst, i) => (inst.Visible = propsRef.current.showAllParts || i === propsRef.current.ownPartIndex))
          osmd.render()
          layout()
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
        setRendering(false)
      }, 0),
    )
  }

  useEffect(() => {
    let cancelled = false
    const osmd = new OpenSheetMusicDisplay(hostRef.current!, {
      autoResize: false,
      backend: 'svg',
      drawTitle: false,
      drawSubtitle: false,
      drawComposer: false,
      drawLyricist: false,
      drawCredits: false,
      drawPartNames: true,
      drawPartAbbreviations: true,
      drawMeasureNumbers: true,
      drawingParameters: 'compacttight',
      followCursor: false,
      defaultColorMusic: INK,
      cursorsOptions: [{ type: 0, color: '#ffb46b', alpha: 0.38, follow: false }],
    })
    osmdRef.current = osmd
    osmd
      .load(xml)
      .then(() => {
        if (cancelled) return
        osmd.Zoom = zoom
        setLoaded(true)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
      osmd.clear()
      osmdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml])

  useEffect(() => {
    if (!loaded || !osmdRef.current) return
    osmdRef.current.Zoom = zoom
    rerender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, zoom, showAllParts, ownPartIndex])

  useEffect(() => {
    if (!loaded) return
    let width = hostRef.current!.clientWidth
    let timer = 0
    const ro = new ResizeObserver(() => {
      const w = hostRef.current?.clientWidth ?? width
      if (Math.abs(w - width) < 24) return
      width = w
      clearTimeout(timer)
      timer = window.setTimeout(rerender, 250)
    })
    ro.observe(hostRef.current!)
    return () => {
      ro.disconnect()
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  useImperativeHandle(ref, () => ({
    setPosition(visit, offsetQ) {
      const steps = visitsRef.current[visit]
      const osmd = osmdRef.current
      if (!steps?.length || !osmd) return
      let step = steps[0]
      for (const s of steps) if (s.offsetQ <= offsetQ + 1e-4) step = s
      if (step === lastStep.current) return
      lastStep.current = step
      try {
        osmd.cursor.iterator = step.iter.clone()
        osmd.cursor.update()
      } catch {
        return
      }
      const el = osmd.cursor.cursorElement
      const box = scrollRef.current
      if (!el || !box) return
      const top = el.offsetTop
      const h = box.clientHeight
      if (top < box.scrollTop + h * 0.08 || top + el.offsetHeight > box.scrollTop + h * 0.85) {
        box.scrollTo({ top: Math.max(0, top - h * 0.15), behavior: 'smooth' })
      }
    },
    colorNote(partIndex, voice, measureIndex, offsetQ, color) {
      let k = key(partIndex, voice, measureIndex, offsetQ)
      if (!notesRef.current.has(k)) k = key(partIndex, '*', measureIndex, offsetQ)
      if (color) colorsRef.current.set(k, color)
      else colorsRef.current.delete(k)
      paint(k, color ?? baseColor(k))
    },
  }))

  const handleClick = (e: React.MouseEvent) => {
    const osmd = osmdRef.current
    const svg = hostRef.current?.querySelector('svg')
    if (!osmd || !svg) return
    const r = svg.getBoundingClientRect()
    const unit = 10 * osmd.Zoom
    const x = (e.clientX - r.left) / unit
    const y = (e.clientY - r.top) / unit
    osmd.GraphicSheet.MeasureList.forEach((staves, mi) => {
      for (const gm of staves) {
        if (!gm) continue
        const b = gm.PositionAndShape
        const ax = b.AbsolutePosition.x
        const ay = b.AbsolutePosition.y
        if (x >= ax + b.BorderLeft && x <= ax + b.BorderRight && y >= ay + b.BorderTop - 2 && y <= ay + b.BorderBottom + 2) {
          onMeasureClick(mi)
          return
        }
      }
    })
  }

  return (
    <div className="relative h-full overflow-hidden rounded-[1.25rem] bg-paper shadow-[0_24px_60px_-30px_rgb(0_0_0/0.9)]">
      <div ref={scrollRef} className="score-paper h-full overflow-y-auto overscroll-contain">
        <div ref={hostRef} onClick={handleClick} role="img" className="min-h-full cursor-pointer px-1 pb-10" aria-label="Partitur. Klicke auf einen Takt, um dorthin zu springen." />
      </div>
      {(rendering || error) && (
        <div className="absolute inset-0 grid place-items-center bg-paper/85 text-ink">
          {error ? (
            <p className="max-w-sm px-6 text-center text-sm">Die Partitur konnte nicht dargestellt werden: {error}</p>
          ) : (
            <span className="size-8 animate-spin rounded-full border-[3px] border-ink/15 border-t-violet" aria-label="Partitur wird gesetzt" />
          )}
        </div>
      )}
      <div className="absolute right-2 bottom-2 flex gap-1 rounded-xl bg-white/90 p-1 text-ink shadow-md backdrop-blur">
        <button
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold hover:bg-ink/8"
          onClick={() => onShowAllParts(!showAllParts)}
          aria-pressed={showAllParts}
          title={showAllParts ? 'Nur meine Stimme zeigen' : 'Alle Stimmen zeigen'}
        >
          {showAllParts ? <Users size={16} /> : <User size={16} />}
          {showAllParts ? 'Alle' : 'Meine'}
        </button>
        <button className="grid size-8 place-items-center rounded-lg hover:bg-ink/8" onClick={() => onZoom(Math.max(0.45, +(zoom - 0.1).toFixed(2)))} aria-label="Partitur verkleinern">
          <Minus size={16} />
        </button>
        <button className="grid size-8 place-items-center rounded-lg hover:bg-ink/8" onClick={() => onZoom(Math.min(1.6, +(zoom + 0.1).toFixed(2)))} aria-label="Partitur vergrößern">
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}
