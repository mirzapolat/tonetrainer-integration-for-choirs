import { openDB, type DBSchema } from 'idb'
import type { ScorePrefs, SessionRecord } from './types'

/**
 * Persistence the trainer needs. The host app may implement this against its own backend;
 * `createIndexedDbStorage()` is a ready-made local default.
 */
export interface PracticeStorage {
  getPrefs(scoreId: string): Promise<ScorePrefs>
  /** Merges `prefs` into what is stored for the score. */
  savePrefs(scoreId: string, prefs: ScorePrefs): Promise<void>
  addSession(session: SessionRecord): Promise<void>
  /** Sessions sorted by `startedAt` ascending; all scores when `scoreId` is omitted. */
  sessions(scoreId?: string): Promise<SessionRecord[]>
  /** Called when the host deletes a score. */
  deleteScore?(scoreId: string): Promise<void>
}

interface Schema extends DBSchema {
  prefs: { key: string; value: ScorePrefs & { scoreId: string } }
  sessions: { key: string; value: SessionRecord; indexes: { bySong: string } }
}

export function createIndexedDbStorage(dbName = 'tonetrainer-practice'): PracticeStorage {
  const dbp = openDB<Schema>(dbName, 1, {
    upgrade(db) {
      db.createObjectStore('prefs', { keyPath: 'scoreId' })
      db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('bySong', 'songId')
    },
  })
  return {
    async getPrefs(scoreId) {
      const p = await (await dbp).get('prefs', scoreId)
      if (!p) return {}
      const { scoreId: _id, ...prefs } = p
      return prefs
    },
    async savePrefs(scoreId, prefs) {
      const db = await dbp
      const old = (await db.get('prefs', scoreId)) ?? { scoreId }
      await db.put('prefs', { ...old, ...prefs, scoreId })
    },
    async addSession(s) {
      await (await dbp).put('sessions', s)
    },
    async sessions(scoreId) {
      const db = await dbp
      const list = scoreId ? await db.getAllFromIndex('sessions', 'bySong', scoreId) : await db.getAll('sessions')
      return list.sort((a, b) => a.startedAt - b.startedAt)
    },
    async deleteScore(scoreId) {
      const db = await dbp
      const tx = db.transaction(['prefs', 'sessions'], 'readwrite')
      await tx.objectStore('prefs').delete(scoreId)
      for (const key of await tx.objectStore('sessions').index('bySong').getAllKeys(scoreId)) await tx.objectStore('sessions').delete(key)
      await tx.done
    },
  }
}
