import { useState, useRef, useCallback } from 'react'

export type RecorderState = 'idle' | 'recording' | 'processing'

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : {}
      const recorder = new MediaRecorder(stream, options)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start(250) // coleta chunks a cada 250ms
      setState('recording')
    } catch (err) {
      setError('Microfone não disponível. Verifique as permissões do browser.')
      setState('idle')
    }
  }, [])

  const stop = useCallback(async (): Promise<Float32Array | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) return resolve(null)
      setState('processing')
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        recorder.stream.getTracks().forEach((t) => t.stop())
        const arrayBuffer = await blob.arrayBuffer()
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        try {
          const decoded = await audioCtx.decodeAudioData(arrayBuffer)
          // Whisper espera Float32Array mono 16kHz
          const mono = decoded.getChannelData(0)
          resolve(mono)
        } catch {
          resolve(null)
        } finally {
          audioCtx.close()
        }
      }
      recorder.stop()
    })
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setError(null)
  }, [])

  return { state, error, start, stop, reset }
}
