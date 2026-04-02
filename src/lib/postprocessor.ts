import { getAllCorrections } from './corrections'
import { getAllGlossaryTerms } from './glossary'

/**
 * Aplica correções aprendidas (count ≥ 3) e glossário ao texto transcrito.
 * Ordem: primeiro glossário (capitalização), depois correções.
 */
export async function postprocess(text: string): Promise<string> {
  let result = text

  // 1. Aplicar glossário: garante capitalização correta de termos técnicos
  const terms = await getAllGlossaryTerms()
  for (const entry of terms) {
    const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Case-insensitive, word-boundary aware
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    result = result.replace(regex, entry.term)
  }

  // 2. Aplicar correções com frequência suficiente
  const corrections = await getAllCorrections()
  const frequent = corrections.filter((c) => c.count >= 3)
  for (const c of frequent) {
    const escaped = c.wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    result = result.replace(regex, c.correct)
  }

  return result
}
