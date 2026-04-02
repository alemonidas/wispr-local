import { useState, useEffect, useCallback } from 'react'
import { getAllGlossaryTerms, addGlossaryTerm, deleteGlossaryTerm, seedGlossary } from '../lib/glossary'
import type { GlossaryEntry } from '../lib/db'

export function GlossaryManager() {
  const [terms, setTerms] = useState<GlossaryEntry[]>([])
  const [newTerm, setNewTerm] = useState('')
  const [newCategory, setNewCategory] = useState('personal')

  const load = useCallback(async () => {
    await seedGlossary()
    setTerms(await getAllGlossaryTerms())
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    const trimmed = newTerm.trim()
    if (!trimmed) return
    await addGlossaryTerm(trimmed, newCategory)
    setNewTerm('')
    load()
  }

  const handleDelete = async (id: number) => {
    await deleteGlossaryTerm(id)
    load()
  }

  const categories = ['dell', 'tech', 'personal']
  const grouped = categories.reduce<Record<string, GlossaryEntry[]>>((acc, cat) => {
    acc[cat] = terms.filter((t) => t.category === cat)
    return acc
  }, {})

  return (
    <div className="glossary-manager">
      <h3>Glossário</h3>
      <p className="hint">Termos adicionados aqui são corrigidos automaticamente na transcrição.</p>

      <div className="glossary-add">
        <input
          type="text"
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
          placeholder="Novo termo (ex: VxRail)"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={handleAdd} className="btn-primary">Adicionar</button>
      </div>

      {categories.map((cat) => (
        grouped[cat].length > 0 && (
          <div key={cat} className="glossary-group">
            <h4>{cat}</h4>
            <ul>
              {grouped[cat].map((t) => (
                <li key={t.id}>
                  <span>{t.term}</span>
                  <button onClick={() => handleDelete(t.id!)} className="btn-delete">✕</button>
                </li>
              ))}
            </ul>
          </div>
        )
      ))}
    </div>
  )
}
