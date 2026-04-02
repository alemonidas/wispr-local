// background.js — Service Worker principal da extensão
// Gerencia estado global, offscreen document e roteamento de mensagens

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html')

let state = {
  recording: false,
  modelStatus: 'idle', // idle | loading | ready | transcribing | error
  modelId: 'Xenova/whisper-tiny',
  language: 'portuguese',
  tabId: null,
  frameId: null,
}

// ── Keep-alive: impede que o MV3 Service Worker morra por inatividade ──────
// Chrome termina o SW após ~30s parado. O alarm dispara a cada 25s para mantê-lo ativo.
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 }) // ~24s

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'keepAlive') return
  const exists = await chrome.offscreen.hasDocument()
  if (!exists) return
  // Pinga o offscreen doc — se responder, modelo está vivo e quente
  chrome.runtime.sendMessage({ type: 'PING' }, (res) => {
    if (chrome.runtime.lastError) return // offscreen morreu silenciosamente
    if (res?.modelLoaded) {
      state.modelStatus = 'ready' // confirma que modelo ainda está na memória
    }
  })
})

// ── Auto-restore: recarrega modelo se SW reiniciou com modelo previamente carregado ──
chrome.storage.local.get(['modelReady', 'modelId', 'language'], async (prefs) => {
  if (!prefs.modelReady) return
  state.modelId = prefs.modelId ?? state.modelId
  state.language = prefs.language ?? state.language
  state.modelStatus = 'loading'
  try {
    await ensureOffscreen()
    await sendToOffscreen({ type: 'LOAD_MODEL', modelId: state.modelId, language: state.language })
    state.modelStatus = 'ready'
  } catch {
    state.modelStatus = 'idle'
  }
})

// ── Offscreen document ────────────────────────────────────────
async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument()
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Transcrição de voz com Whisper WASM',
    })
  }
}

// ── Mensagens recebidas ───────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender, sendResponse)
  return true // mantém canal aberto para respostas assíncronas
})

async function handleMessage(msg, sender, sendResponse) {
  switch (msg.type) {
    // Content script avisa que começou a gravar
    case 'RECORDING_STARTED':
      state.recording = true
      state.tabId = sender.tab?.id
      state.frameId = sender.frameId
      broadcastStatus()
      sendResponse({ ok: true })
      break

    // Content script envia áudio (base64)
    case 'AUDIO_READY': {
      state.recording = false
      state.modelStatus = 'transcribing'
      // Usa o tabId do sender direto — funciona mesmo após reinício do SW
      const targetTabId = sender.tab?.id ?? state.tabId
      state.tabId = targetTabId
      broadcastStatus()
      try {
        await ensureOffscreen()
        const text = await transcribeInOffscreen(msg.audio, msg.sampleRate)
        if (targetTabId !== null && targetTabId !== undefined) {
          chrome.tabs.sendMessage(targetTabId, { type: 'TRANSCRIPTION_RESULT', text })
        }
        state.modelStatus = 'ready'
      } catch (err) {
        state.modelStatus = 'error'
        console.error('[VoiceFlow] Erro na transcrição:', err)
        if (targetTabId !== null && targetTabId !== undefined) {
          chrome.tabs.sendMessage(targetTabId, { type: 'TRANSCRIPTION_ERROR', message: String(err) })
        }
      }
      broadcastStatus()
      sendResponse({ ok: true })
      break
    }

    // Content/popup pede para carregar o modelo
    case 'LOAD_MODEL':
      state.modelId = msg.modelId ?? state.modelId
      state.language = msg.language ?? state.language
      state.modelStatus = 'loading'
      broadcastStatus()
      try {
        await ensureOffscreen()
        await sendToOffscreen({ type: 'LOAD_MODEL', modelId: state.modelId, language: state.language })
        state.modelStatus = 'ready'
      } catch (err) {
        state.modelStatus = 'error'
        console.error('[VoiceFlow] Erro ao carregar modelo:', err)
      }
      broadcastStatus()
      sendResponse({ ok: true, status: state.modelStatus })
      break

    // Popup ou content pede o status atual
    case 'GET_STATUS':
      sendResponse({ ...state })
      break

    // Offscreen avisa sobre progresso do download do modelo
    case 'MODEL_PROGRESS':
      state.modelStatus = 'loading'
      broadcastStatus({ progress: msg.progress, message: msg.message })
      sendResponse({ ok: true })
      break

    // Offscreen avisa que modelo está pronto
    case 'MODEL_READY':
      state.modelStatus = 'ready'
      // Persiste que o modelo está carregado — sobrevive a reinícios do SW
      chrome.storage.local.set({ modelReady: true, modelId: state.modelId, language: state.language })
      broadcastStatus()
      sendResponse({ ok: true })
      break

    default:
      sendResponse({ ok: false, error: 'unknown message type' })
  }
}

// ── Comunicação com offscreen ────────────────────────────────
function sendToOffscreen(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        resolve(response)
      }
    })
  })
}

async function transcribeInOffscreen(audioArray, sampleRate) {
  return new Promise((resolve, reject) => {
    const listener = (msg) => {
      if (msg.type === 'TRANSCRIPTION_DONE') {
        chrome.runtime.onMessage.removeListener(listener)
        resolve(msg.text)
      } else if (msg.type === 'TRANSCRIPTION_ERROR_OFFSCREEN') {
        chrome.runtime.onMessage.removeListener(listener)
        reject(new Error(msg.message))
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    chrome.runtime.sendMessage({
      type: 'TRANSCRIBE',
      audio: audioArray,
      sampleRate,
      modelId: state.modelId,
      language: state.language,
    })
  })
}

// ── Broadcast de status para popup e content scripts ─────────
function broadcastStatus(extra = {}) {
  const payload = { type: 'STATUS_UPDATE', ...state, ...extra }
  // Para popup
  chrome.runtime.sendMessage(payload).catch(() => {})
  // Para aba ativa
  if (state.tabId !== null) {
    chrome.tabs.sendMessage(state.tabId, payload).catch(() => {})
  }
}

// ── Clique no ícone da extensão → toggle gravação ─────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (state.modelStatus === 'idle') {
    // Primeiro clique: carrega o modelo
    state.tabId = tab.id
    await handleMessage({ type: 'LOAD_MODEL' }, { tab, frameId: 0 }, () => {})
    return
  }
  // Toggle via content script
  chrome.tabs.sendMessage(tab.id, {
    type: state.recording ? 'STOP_RECORDING' : 'START_RECORDING',
  }).catch(() => {})
})
