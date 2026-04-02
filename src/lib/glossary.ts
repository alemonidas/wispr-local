import { db, type GlossaryEntry } from './db'

// Glossário pré-carregado com termos Dell / tech comuns
const SEED_TERMS: Omit<GlossaryEntry, 'id' | 'addedAt'>[] = [
  { term: 'Dell Technologies', category: 'dell' },
  { term: 'PowerEdge', category: 'dell' },
  { term: 'PowerStore', category: 'dell' },
  { term: 'VxRail', category: 'dell' },
  { term: 'Apex', category: 'dell' },
  { term: 'iDRAC', category: 'dell' },
  { term: 'OpenManage', category: 'dell' },
  { term: 'OMNI', category: 'dell' },
  { term: 'TypeScript', category: 'tech' },
  { term: 'React', category: 'tech' },
  { term: 'SvelteKit', category: 'tech' },
]

export async function seedGlossary(): Promise<void> {
  const store = await db
  const existing = await store.getAll('glossary')
  if (existing.length > 0) return
  const tx = store.transaction('glossary', 'readwrite')
  for (const term of SEED_TERMS) {
    await tx.store.add({ ...term, addedAt: Date.now() })
  }
  await tx.done
}

export async function addGlossaryTerm(term: string, category = 'personal'): Promise<void> {
  await (await db).add('glossary', { term, category, addedAt: Date.now() })
}

export async function getAllGlossaryTerms(): Promise<GlossaryEntry[]> {
  return (await db).getAll('glossary')
}

export async function deleteGlossaryTerm(id: number): Promise<void> {
  return (await db).delete('glossary', id)
}
