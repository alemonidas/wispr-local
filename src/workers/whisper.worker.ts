import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

// Não usar o cache local do browser (usa HuggingFace CDN, cacheado pelo Service Worker)
env.allowLocalModels = false

type ModelId = 'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small'

let transcriber: AutomaticSpeechRecognitionPipeline | null = null
let currentModel: ModelId | null = null

export interface WorkerRequest {
  type: 'load' | 'transcribe'
  model?: ModelId
  audio?: Float32Array
  language?: string
}

export interface WorkerResponse {
  type: 'ready' | 'progress' | 'result' | 'error'
  text?: string
  chunks?: Array<{ text: string; timestamp: [number, number] }>
  progress?: number
  message?: string
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, model, audio, language } = event.data

  if (type === 'load') {
    const modelId: ModelId = model ?? 'Xenova/whisper-tiny'
    if (transcriber && currentModel === modelId) {
      self.postMessage({ type: 'ready' } satisfies WorkerResponse)
      return
    }
    try {
      self.postMessage({ type: 'progress', progress: 0, message: 'Baixando modelo...' } satisfies WorkerResponse)
      transcriber = await pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q4', // quantizado 4-bit — muito mais rápido
        progress_callback: (info: { progress?: number; status?: string }) => {
          if (info.progress !== undefined) {
            self.postMessage({ type: 'progress', progress: Math.round(info.progress), message: info.status ?? 'Carregando...' } satisfies WorkerResponse)
          }
        },
      })
      currentModel = modelId
      self.postMessage({ type: 'ready' } satisfies WorkerResponse)
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) } satisfies WorkerResponse)
    }
    return
  }

  if (type === 'transcribe') {
    if (!transcriber || !audio) {
      self.postMessage({ type: 'error', message: 'Modelo não carregado ou áudio inválido' } satisfies WorkerResponse)
      return
    }
    try {
      const result = await transcriber(audio, {
        language: language ?? 'portuguese',
        task: 'transcribe',
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      })
      const output = result as { text: string; chunks?: Array<{ text: string; timestamp: [number, number] }> }
      self.postMessage({
        type: 'result',
        text: output.text?.trim() ?? '',
        chunks: output.chunks ?? [],
      } satisfies WorkerResponse)
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) } satisfies WorkerResponse)
    }
  }
}
