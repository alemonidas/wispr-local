import { openDB, type DBSchema } from 'idb'

export interface Correction {
  id?: number
  wrong: string
  correct: string
  count: number
  updatedAt: number
}

export interface GlossaryEntry {
  id?: number
  term: string
  category: string // 'dell', 'tech', 'personal', etc.
  addedAt: number
}

export interface HistoryEntry {
  id?: number
  text: string
  model: string
  lang: string
  duration: number
  createdAt: number
}

interface VoiceFlowDB extends DBSchema {
  corrections: {
    key: number
    value: Correction
    indexes: { 'by-wrong': string }
  }
  glossary: {
    key: number
    value: GlossaryEntry
    indexes: { 'by-term': string }
  }
  history: {
    key: number
    value: HistoryEntry
    indexes: { 'by-date': number }
  }
}

export const db = openDB<VoiceFlowDB>('voiceflow', 1, {
  upgrade(db) {
    const corrections = db.createObjectStore('corrections', {
      keyPath: 'id',
      autoIncrement: true,
    })
    corrections.createIndex('by-wrong', 'wrong', { unique: false })

    const glossary = db.createObjectStore('glossary', {
      keyPath: 'id',
      autoIncrement: true,
    })
    glossary.createIndex('by-term', 'term', { unique: true })

    const history = db.createObjectStore('history', {
      keyPath: 'id',
      autoIncrement: true,
    })
    history.createIndex('by-date', 'createdAt')
  },
})
