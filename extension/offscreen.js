// offscreen.js — contexto DOM isolado para rodar Transformers.js + Whisper
// Este arquivo é bundlado pelo esbuild junto com @huggingface/transformers

import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false
// Usa cache do browser (cacheStorage) para persistir o modelo entre sessões
env.useBrowserCache = true

let transcriber = null
let currentModel = null

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Keep-alive ping — responde imediatamente para o SW saber que o modelo está vivo
  if (msg.type === 'PING') {
    sendResponse({ ok: true, modelLoaded: !!transcriber, modelId: currentModel })
    return true
  }

  if (msg.type === 'LOAD_MODEL') {
    loadModel(msg.modelId ?? 'Xenova/whisper-tiny', msg.language ?? 'portuguese')
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true
  }

  if (msg.type === 'TRANSCRIBE') {
    // Converte base64 de volta para Float32Array
    const audio = base64ToFloat32Array(msg.audio)
    transcribe(audio, msg.language ?? 'portuguese', msg.modelId)
      .then((text) => {
        chrome.runtime.sendMessage({ type: 'TRANSCRIPTION_DONE', text })
        sendResponse({ ok: true })
      })
      .catch((err) => {
        chrome.runtime.sendMessage({ type: 'TRANSCRIPTION_ERROR_OFFSCREEN', message: String(err) })
        sendResponse({ ok: false, error: String(err) })
      })
    return true
  }
})

function base64ToFloat32Array(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

async function loadModel(modelId, _language) {
  if (transcriber && currentModel === modelId) {
    chrome.runtime.sendMessage({ type: 'MODEL_READY' })
    return
  }

  chrome.runtime.sendMessage({ type: 'MODEL_PROGRESS', progress: 0, message: 'Baixando modelo...' })

  transcriber = await pipeline('automatic-speech-recognition', modelId, {
    dtype: 'q4',
    progress_callback: (info) => {
      if (info.progress !== undefined) {
        chrome.runtime.sendMessage({
          type: 'MODEL_PROGRESS',
          progress: Math.round(info.progress),
          message: info.status ?? 'Carregando...',
        })
      }
    },
  })

  currentModel = modelId
  chrome.runtime.sendMessage({ type: 'MODEL_READY' })
}

async function transcribe(audio, language, modelId) {
  if (!transcriber || currentModel !== modelId) {
    await loadModel(modelId ?? 'Xenova/whisper-tiny', language)
  }

  const result = await transcriber(audio, {
    language: language ?? 'portuguese',
    task: 'transcribe',
    return_timestamps: false,
    chunk_length_s: 30,
    stride_length_s: 5,
  })

  return result.text?.trim() ?? ''
}
