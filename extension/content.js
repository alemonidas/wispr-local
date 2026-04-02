// content.js — injetado em todas as páginas
// Captura hotkey, grava áudio, injeta texto no campo com foco

;(function () {
  if (window.__voiceFlowLoaded) return
  window.__voiceFlowLoaded = true

  let isRecording = false
  let mediaRecorder = null
  let chunks = []
  let activeElement = null
  let indicator = null

  // ── Hotkey: Ctrl+Shift+Space (hold = gravar, release = parar) ──
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'Space' && !isRecording) {
      e.preventDefault()
      e.stopPropagation()
      startRecording()
    }
  })

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && isRecording) {
      e.preventDefault()
      stopRecording()
    }
  })

  // ── Mensagens do background ───────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'START_RECORDING') startRecording()
    if (msg.type === 'STOP_RECORDING') stopRecording()
    if (msg.type === 'TRANSCRIPTION_RESULT') injectText(msg.text)
    if (msg.type === 'TRANSCRIPTION_ERROR') showError(msg.message)
    if (msg.type === 'STATUS_UPDATE') updateIndicator(msg)
  })

  // ── Gravação ──────────────────────────────────────────────────
  async function startRecording() {
    if (isRecording) return

    // Salva elemento com foco antes de qualquer prompt do browser
    activeElement = document.activeElement

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      showError('Microfone não disponível. Verifique as permissões do Chrome.')
      return
    }

    chunks = []
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? { mimeType: 'audio/webm;codecs=opus' }
      : {}
    mediaRecorder = new MediaRecorder(stream, options)
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    mediaRecorder.start(250)
    isRecording = true
    showIndicator()
    chrome.runtime.sendMessage({ type: 'RECORDING_STARTED' })
  }

  function stopRecording() {
    if (!mediaRecorder || !isRecording) return
    mediaRecorder.onstop = async () => {
      mediaRecorder.stream.getTracks().forEach((t) => t.stop())
      hideIndicator()
      showProcessing()
      const audio = await decodeAudio()
      if (audio) {
        chrome.runtime.sendMessage({
          type: 'AUDIO_READY',
          audio: float32ToBase64(audio), // base64 — muito mais rápido que Array.from
          sampleRate: 16000,
        })
      }
    }
    mediaRecorder.stop()
    isRecording = false
  }

  async function decodeAudio() {
    const blob = new Blob(chunks, { type: mediaRecorder?.mimeType ?? 'audio/webm' })
    const arrayBuffer = await blob.arrayBuffer()
    const audioCtx = new AudioContext({ sampleRate: 16000 })
    try {
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      return decoded.getChannelData(0) // mono Float32Array
    } catch (err) {
      showError('Erro ao processar áudio: ' + err.message)
      return null
    } finally {
      audioCtx.close()
    }
  }

  // ── Injeção de texto ──────────────────────────────────────────
  function injectText(text) {
    hideProcessing()
    if (!text) return

    const el = activeElement
    if (!el) return

    // Tenta restaurar foco
    if (el && typeof el.focus === 'function') el.focus()

    // Estratégia 1: execCommand (funciona na maioria dos sites)
    if (document.execCommand('insertText', false, text)) return

    // Estratégia 2: para input/textarea — manipula .value diretamente
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      el.value = el.value.slice(0, start) + text + el.value.slice(end)
      el.selectionStart = el.selectionEnd = start + text.length
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }

    // Estratégia 3: contenteditable (Gmail, Notion, Slack web, etc.)
    if (el.isContentEditable || el.contentEditable === 'true') {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const node = document.createTextNode(text)
        range.insertNode(node)
        range.setStartAfter(node)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }))
      }
    }
  }

  // ── Indicador visual ──────────────────────────────────────────
  function showIndicator() {
    if (indicator) return
    indicator = document.createElement('div')
    indicator.id = '__voiceflow_indicator'
    indicator.textContent = '🎙 Gravando...'
    Object.assign(indicator.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: '#e94560',
      color: '#fff',
      padding: '10px 18px',
      borderRadius: '24px',
      fontSize: '14px',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontWeight: '600',
      zIndex: '2147483647',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      animation: 'voiceflow-pulse 1.2s ease-in-out infinite',
    })
    injectStyle()
    document.body.appendChild(indicator)
  }

  function hideIndicator() {
    indicator?.remove()
    indicator = null
  }

  function showProcessing() {
    if (indicator) return
    indicator = document.createElement('div')
    indicator.id = '__voiceflow_indicator'
    indicator.textContent = '⟳ Transcrevendo...'
    Object.assign(indicator.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: '#533483',
      color: '#fff',
      padding: '10px 18px',
      borderRadius: '24px',
      fontSize: '14px',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontWeight: '600',
      zIndex: '2147483647',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    })
    document.body.appendChild(indicator)
    setTimeout(hideProcessing, 8000) // timeout de segurança
  }

  function hideProcessing() {
    indicator?.remove()
    indicator = null
  }

  function showError(msg) {
    hideIndicator()
    hideProcessing()
    const el = document.createElement('div')
    el.textContent = '⚠️ ' + msg
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: '#333',
      color: '#fff',
      padding: '10px 18px',
      borderRadius: '24px',
      fontSize: '13px',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      zIndex: '2147483647',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    })
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 4000)
  }

  function updateIndicator(status) {
    // futuro: atualizar badge ou estado do indicador
  }

  // Codifica Float32Array como base64 — muito mais rápido que Array.from()
  // 10s de áudio @ 16kHz = 640KB binário → ~853KB base64 (vs ~2.5MB como array JSON)
  function float32ToBase64(float32Array) {
    const bytes = new Uint8Array(float32Array.buffer)
    let binary = ''
    const chunk = 0x8000 // 32KB por iteração para evitar stack overflow
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  }

  function injectStyle() {
    if (document.getElementById('__voiceflow_style')) return
    const style = document.createElement('style')
    style.id = '__voiceflow_style'
    style.textContent = `
      @keyframes voiceflow-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.85; transform: scale(1.03); }
      }
    `
    document.head.appendChild(style)
  }
})()
