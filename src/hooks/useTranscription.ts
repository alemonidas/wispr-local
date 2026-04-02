import { useState, useRef, useCallback, useEffect } from 'react'
import type { WorkerRequest, WorkerResponse } from '../workers/whisper.worker'

export type ModelId = 'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small'
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error'

export interface Chunk {
  text: string
  timestamp: [number, number]
}

export function useTranscription(model: ModelId = 'Xenova/whisper-tiny', language = 'portuguese') {
  const [status, setStatus] = useState<ModelStatus>('idle')
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadMessage, setLoadMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const resolveRef = useRef<((result: { text: string; chunks: Chunk[] }) => void) | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setLoadProgress(msg.progress ?? 0)
        setLoadMessage(msg.message ?? '')
      } else if (msg.type === 'ready') {
        setStatus('ready')
        setLoadProgress(100)
      } else if (msg.type === 'result') {
        setStatus('ready')
        resolveRef.current?.({ text: msg.text ?? '', chunks: msg.chunks ?? [] })
        resolveRef.current = null
      } else if (msg.type === 'error') {
        setError(msg.message ?? 'Erro desconhecido')
        setStatus('error')
        resolveRef.current?.({ text: '', chunks: [] })
        resolveRef.current = null
      }
    }

    return () => worker.terminate()
  }, [])

  const load = useCallback(() => {
    if (!workerRef.current) return
    setStatus('loading')
    setError(null)
    const req: WorkerRequest = { type: 'load', model }
    workerRef.current.postMessage(req)
  }, [model])

  const transcribe = useCallback(
    (audio: Float32Array): Promise<{ text: string; chunks: Chunk[] }> => {
      return new Promise((resolve) => {
        if (!workerRef.current) return resolve({ text: '', chunks: [] })
        setStatus('transcribing')
        resolveRef.current = resolve
        const req: WorkerRequest = { type: 'transcribe', audio, language }
        workerRef.current.postMessage(req, [audio.buffer])
      })
    },
    [language],
  )

  return { status, loadProgress, loadMessage, error, load, transcribe }
}
