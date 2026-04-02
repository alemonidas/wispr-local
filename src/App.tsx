import { useState, useCallback } from 'react'
import { AudioRecorder } from './components/AudioRecorder'
import { TranscriptDisplay } from './components/TranscriptDisplay'
import { GlossaryManager } from './components/GlossaryManager'
import { Settings } from './components/Settings'
import { useTranscription, type ModelId } from './hooks/useTranscription'
import { postprocess } from './lib/postprocessor'
import { db } from './lib/db'
import './App.css'

type Tab = 'recorder' | 'glossary' | 'settings'

export function App() {
  const [model, setModel] = useState<ModelId>('Xenova/whisper-tiny')
  const [language, setLanguage] = useState('portuguese')
  const [transcript, setTranscript] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>('recorder')
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark',
  )

  const { status, loadProgress, loadMessage, error: workerError, load, transcribe } = useTranscription(model, language)

  const handleModelChange = useCallback((m: ModelId) => {
    setModel(m)
  }, [])

  const handleLanguageChange = useCallback((l: string) => {
    setLanguage(l)
  }, [])

  const handleAudioReady = useCallback(async (audio: Float32Array) => {
    const result = await transcribe(audio)
    if (!result.text) return
    const processed = await postprocess(result.text)
    setTranscript(processed)
    setHistory((prev) => [processed, ...prev.slice(0, 19)])
    const store = await db
    await store.add('history', {
      text: processed,
      model,
      lang: language,
      duration: audio.length / 16000,
      createdAt: Date.now(),
    })
  }, [transcribe, model, language])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  const handleExport = () => {
    const blob = new Blob([transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcricao-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={`app ${theme}`} data-theme={theme}>
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🎙</span>
          <span className="logo-text">VoiceFlow Local</span>
        </div>
        <nav className="tab-nav">
          {(['recorder', 'glossary', 'settings'] as Tab[]).map((t) => (
            <button type="button" key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'recorder' ? '🎙 Gravar' : t === 'glossary' ? '📚 Glossário' : '⚙️ Config'}
            </button>
          ))}
        </nav>
        <button type="button" className="theme-toggle" onClick={toggleTheme} title="Alternar tema">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      <main className="app-main">
        {tab === 'recorder' && (
          <div className="recorder-tab">
            {status === 'idle' && (
              <div className="model-prompt">
                <p>Clique em <strong>Ativar</strong> para carregar o modelo de fala (feito uma vez, fica offline).</p>
              </div>
            )}
            {status === 'loading' && (
              <div className="load-progress">
                <progress className="progress-bar" value={loadProgress} max={100} />
                <p>{loadMessage} ({loadProgress}%)</p>
              </div>
            )}
            {workerError && <div className="error-banner">⚠️ {workerError}</div>}

            <AudioRecorder modelStatus={status} onLoadModel={load} onAudioReady={handleAudioReady} />

            <TranscriptDisplay text={transcript} onCorrectionSaved={() => {}} />

            {transcript && (
              <div className="transcript-toolbar">
                <button type="button" className="btn-ghost" onClick={handleExport}>⬇️ Exportar .txt</button>
              </div>
            )}

            {history.length > 1 && (
              <details className="history-section">
                <summary>Histórico ({history.length - 1} anteriores)</summary>
                <ul>
                  {history.slice(1).map((h, i) => (
                    <li key={i} onClick={() => setTranscript(h)} className="history-item">
                      {h.slice(0, 80)}{h.length > 80 ? '…' : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {tab === 'glossary' && <GlossaryManager />}

        {tab === 'settings' && (
          <Settings
            model={model}
            language={language}
            onModelChange={handleModelChange}
            onLanguageChange={handleLanguageChange}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>100% offline · sem custos · aprende com você</span>
        {status === 'ready' && <span className="status-badge ready">● Pronto</span>}
        {status === 'loading' && <span className="status-badge loading">● Carregando</span>}
        {status === 'transcribing' && <span className="status-badge transcribing">● Transcrevendo</span>}
      </footer>
    </div>
  )
}

export default App
