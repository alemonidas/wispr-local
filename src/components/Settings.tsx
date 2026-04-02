import type { ModelId } from '../hooks/useTranscription'

interface Props {
  model: ModelId
  language: string
  onModelChange: (m: ModelId) => void
  onLanguageChange: (l: string) => void
}

const MODELS: { id: ModelId; label: string; size: string; speed: string }[] = [
  { id: 'Xenova/whisper-tiny', label: 'Tiny', size: '~40MB', speed: 'Muito rápido' },
  { id: 'Xenova/whisper-base', label: 'Base', size: '~140MB', speed: 'Rápido' },
  { id: 'Xenova/whisper-small', label: 'Small', size: '~500MB', speed: 'Preciso' },
]

const LANGUAGES = [
  { code: 'portuguese', label: 'Português' },
  { code: 'english', label: 'English' },
  { code: 'spanish', label: 'Español' },
]

export function Settings({ model, language, onModelChange, onLanguageChange }: Props) {
  return (
    <div className="settings-panel">
      <h3>Configurações</h3>

      <div className="setting-group">
        <label>Modelo Whisper</label>
        <div className="model-cards">
          {MODELS.map((m) => (
            <button
              key={m.id}
              className={`model-card ${model === m.id ? 'active' : ''}`}
              onClick={() => onModelChange(m.id)}
            >
              <strong>{m.label}</strong>
              <span>{m.size}</span>
              <span className="speed-tag">{m.speed}</span>
            </button>
          ))}
        </div>
        <p className="hint">O modelo é baixado uma vez e fica em cache offline.</p>
      </div>

      <div className="setting-group">
        <label>Idioma</label>
        <select value={language} onChange={(e) => onLanguageChange(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
