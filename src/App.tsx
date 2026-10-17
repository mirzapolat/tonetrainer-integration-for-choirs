import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useState } from 'react'
import Library from './components/library/Library'
import SongProgress from './components/SongProgress'

// The practice view pulls in the score engraver (OSMD, ~1.5 MB); load it only when needed.
const PracticeView = lazy(() => import('./components/practice/PracticeView'))

export type Route = { page: 'library' } | { page: 'practice'; id: string; measure?: number } | { page: 'progress'; id: string }

function parse(hash: string): Route {
  const [, page, id, measure] = hash.replace(/^#/, '').split('/')
  if (page === 'ueben' && id) return { page: 'practice', id, measure: measure ? Number(measure) : undefined }
  if (page === 'fortschritt' && id) return { page: 'progress', id }
  return { page: 'library' }
}

export const href = {
  library: () => '#/',
  practice: (id: string) => `#/ueben/${id}`,
  /** Opens the practice view with the given source measure (0-based) looped. */
  practiceMeasure: (id: string, measureIndex: number) => `#/ueben/${id}/${measureIndex}`,
  progress: (id: string) => `#/fortschritt/${id}`,
}

export default function App() {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const onHash = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const key = route.page === 'library' ? 'library' : route.page === 'practice' ? `practice:${route.id}:${route.measure ?? ''}` : `${route.page}:${route.id}`
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="min-h-dvh"
      >
        {route.page === 'library' && <Library />}
        {route.page === 'practice' && (
          <Suspense fallback={null}>
            <PracticeView songId={route.id} loopMeasure={route.measure} />
          </Suspense>
        )}
        {route.page === 'progress' && <SongProgress songId={route.id} />}
      </motion.div>
    </AnimatePresence>
  )
}
