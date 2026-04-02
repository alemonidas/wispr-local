import { useEffect } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import type { ModelStatus } from '../hooks/useTranscription'

interface Props {
  modelStatus: ModelStatus
  onLoadModel: () => void
  onAudioReady: (audio: Float32Array) => void
}

export function AudioRecorder({ modelStatus, onLoadModel, onAudioReady }: Props) {
  const { state, error, start, stop } = useRecorder()

  // Atalho de teclado: Espaço para gravar/parar
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.target !== document.body) return
      e.preventDefault()
      if (state === 'idle' && modelStatus === 'ready') await start()
      else if (state === 'recording') {
        const audio = await stop()
        if (audio) onAudioReady(audio)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, modelStatus, start, stop, onAudioReady])

  const handleClick = async () => {
    if (modelStatus !== 'ready' && modelStatus !== 'loading') {
      onLoadModel()
      return
    }
    if (state === 'idle' && modelStatus === 'ready') {
      await start()
    } else if (state === 'recording') {
      const audio = await stop()
      if (audio) onAudioReady(audio)
    }
  }

  const isRecording = state === 'recording'
  const isProcessing = state === 'processing' || modelStatus === 'transcribing'
  const canRecord = modelStatus === 'ready'

  return (
    <div className="recorder-container">
      <button
        className={`record-btn ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
        onClick={handleClick}
        disabled={isProcessing || modelStatus === 'loading'}
        title={canRecord ? (isRecording ? 'Parar gravação (Espaço)' : 'Gravar (Espaço)') : 'Carregar modelo primeiro'}
      >
        {isRecording ? (
          <span className="btn-icon">⏹</span>
        ) : isProcessing ? (
          <span className="btn-icon spin">⟳</span>
        ) : modelStatus === 'loading' ? (
          <span className="btn-icon spin">⟳</span>
        ) : modelStatus !== 'ready' ? (
          <span className="btn-icon">▶ Ativar</span>
        ) : (
          <span className="btn-icon">🎙</span>
        )}
      </button>

      {isRecording && (
        <div className="recording-indicator">
          <span className="pulse-dot" />
          Gravando... pressione Espaço ou clique para parar
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}
    </div>
  )
}
