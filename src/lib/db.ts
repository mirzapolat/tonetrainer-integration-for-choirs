import { openDB, type DBSchema } from 'idb'
import type { Channel } from './audio/player'

export interface TrackSummary {
  id: string
  name: string
  low: number
  high: number
  noteCount: number
}

export interface SongPrefs {
  trackId?: string
  mixer?: Record<string, Channel>
  zoom?: number
  zoomMobile?: number
  tempoFactor?: number
}

export interface SongRecord {
  id: string
  title: string
  composer: string
  fileName: string
  xml: string
  addedAt: number
  lastPracticedAt?: number
  tracks: TrackSummary[]
  prefs: SongPrefs
}

export type Grade = 'good' | 'ok' | 'flat' | 'sharp' | 'silent'

export interface MeasureStat {
  label: string
  n: number
  /** Sum of per-note scores (good = 1, ok = 0.6, otherwise 0). */
  score: number
  good: number
  ok: number
  flat: number
  sharp: number
  silent: number
  biasSum: number
  biasN: number
}

export interface SessionRecord {
  id: string
  songId: string
  trackId: string
  trackName: string
  mode: 'play' | 'wait'
  startedAt: number
  endedAt: number
  practiceSec: number
  notes: number
  accuracy: number
  tempoFactor: number
  measures: Record<number, MeasureStat>
}

interface Schema extends DBSchema {
  songs: { key: string; value: SongRecord }
  sessions: { key: string; value: SessionRecord; indexes: { bySong: string; byStart: number } }
}

const dbPromise = openDB<Schema>('tonetrainer', 1, {
  upgrade(db) {
    db.createObjectStore('songs', { keyPath: 'id' })
    const s = db.createObjectStore('sessions', { keyPath: 'id' })
    s.createIndex('bySong', 'songId')
    s.createIndex('byStart', 'startedAt')
  },
})

export const db = {
  async songs() {
    const all = await (await dbPromise).getAll('songs')
    return all.sort((a, b) => (b.lastPracticedAt ?? b.addedAt) - (a.lastPracticedAt ?? a.addedAt))
  },
  async song(id: string) {
    return (await dbPromise).get('songs', id)
  },
  async putSong(song: SongRecord) {
    await (await dbPromise).put('songs', song)
  },
  async updateSong(id: string, patch: Partial<SongRecord>) {
    const d = await dbPromise
    const s = await d.get('songs', id)
    if (s) await d.put('songs', { ...s, ...patch, prefs: { ...s.prefs, ...patch.prefs } })
  },
  async deleteSong(id: string) {
    const d = await dbPromise
    const tx = d.transaction(['songs', 'sessions'], 'readwrite')
    await tx.objectStore('songs').delete(id)
    for (const key of await tx.objectStore('sessions').index('bySong').getAllKeys(id)) await tx.objectStore('sessions').delete(key)
    await tx.done
  },
  async addSession(s: SessionRecord) {
    await (await dbPromise).put('sessions', s)
    await db.updateSong(s.songId, { lastPracticedAt: s.endedAt })
  },
  async sessions(songId?: string) {
    const d = await dbPromise
    const list = songId ? await d.getAllFromIndex('sessions', 'bySong', songId) : await d.getAll('sessions')
    return list.sort((a, b) => a.startedAt - b.startedAt)
  },
}
