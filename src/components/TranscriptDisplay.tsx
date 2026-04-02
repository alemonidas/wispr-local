import { useState } from 'react'
import { saveCorrection } from '../lib/corrections'

interface Props {
  text: string
  onCorrectionSaved?: () => void
}

export function TranscriptDisplay({ text, onCorrectionSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [copied, setCopied] = useState(false)

  const handleEditStart = () => {
    setEditText(text)
    setEditing(true)
  }

  const handleEditSave = async () => {
    // Detecta diferenças palavra-a-palavra e salva correções
    const original = text.split(/\s+/)
    const corrected = editText.split(/\s+/)
    const len = Math.min(original.length, corrected.length)
    for (let i = 0; i < len; i++) {
      if (original[i].toLowerCase() !== corrected[i].toLowerCase()) {
        await saveCorrection(original[i], corrected[i])
      }
    }
    setEditing(false)
    onCorrectionSaved?.()
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!text) {
    return (
      <div className="transcript-empty">
        <p>Sua transcrição aparecerá aqui.</p>
        <p className="hint">Pressione <kbd>Espaço</kbd> ou o botão para começar a gravar.</p>
      </div>
    )
  }

  return (
    <div className="transcript-display">
      {editing ? (
        <textarea
          className="transcript-edit"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          autoFocus
          rows={6}
        />
      ) : (
        <p className="transcript-text">{text}</p>
      )}
      <div className="transcript-actions">
        {editing ? (
          <>
            <button onClick={handleEditSave} className="btn-primary">Salvar correção</button>
            <button onClick={() => setEditing(false)} className="btn-ghost">Cancelar</button>
          </>
        ) : (
          <>
            <button onClick={handleCopy} className="btn-ghost">
              {copied ? '✓ Copiado!' : '📋 Copiar'}
            </button>
            <button onClick={handleEditStart} className="btn-ghost">✏️ Editar & Aprender</button>
          </>
        )}
      </div>
    </div>
  )
}
