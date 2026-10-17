import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

/** Thin wrapper around the native <dialog>: focus trap, Esc and top-layer come for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  sheet = true,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  sheet?: boolean
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={sheet ? 'sheet' : ''}
      style={wide ? { maxWidth: 'min(52rem, calc(100vw - 2rem))' } : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Schließen">
            <X size={20} />
          </button>
        </header>
        <div className="overflow-y-auto px-6 pb-6">{open && children}</div>
      </div>
    </dialog>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  stretch = false,
}: {
  value: T | null
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
  /** Fill the available width with equally sized segments. */
  stretch?: boolean
}) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className={`${stretch ? 'flex w-full [&>button]:flex-1' : 'inline-flex'} rounded-xl bg-white/6 p-1 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative rounded-lg font-semibold transition-colors ${size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-sm'} ${active ? 'text-[#2a1d0b]' : 'text-mist hover:text-chalk'}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-gold"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center justify-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2.5">
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-mist">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
    </label>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format: (v: number) => string
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <label className="block py-2.5">
      <span className="flex items-baseline justify-between gap-4">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-sm text-gold">{format(value)}</span>
      </span>
      {hint && <span className="mt-0.5 block text-sm text-mist">{hint}</span>}
      <input type="range" className="mt-2" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function Logo({ size = 36 }: { size?: number }) {
  return <img src="/logo.png" width={size} height={size} alt="" className="rounded-[22%] shadow-[0_6px_20px_-6px_rgb(138_63_252/0.7)]" />
}
