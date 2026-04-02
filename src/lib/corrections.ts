import { db, type Correction } from './db'

export async function saveCorrection(wrong: string, correct: string): Promise<void> {
  const store = await db
  const tx = store.transaction('corrections', 'readwrite')
  const existing = await tx.store.index('by-wrong').getAll(wrong.toLowerCase())
  const match = existing.find((c) => c.correct === correct)
  if (match && match.id !== undefined) {
    await tx.store.put({ ...match, count: match.count + 1, updatedAt: Date.now() })
  } else {
    await tx.store.add({ wrong: wrong.toLowerCase(), correct, count: 1, updatedAt: Date.now() })
  }
  await tx.done
}

export async function getAllCorrections(): Promise<Correction[]> {
  return (await db).getAll('corrections')
}

export async function deleteCorrection(id: number): Promise<void> {
  return (await db).delete('corrections', id)
}
