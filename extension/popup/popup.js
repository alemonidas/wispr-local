// popup.js — lógica do popup da extensão

const statusDot   = document.getElementById('statusDot')
const statusText  = document.getElementById('statusText')
const progressWrap = document.getElementById('progressWrap')
const progressBar  = document.getElementById('progressBar')
const progressLabel = document.getElementById('progressLabel')
const modelSelect  = document.getElementById('modelSelect')
const langSelect   = document.getElementById('langSelect')
const loadBtn      = document.getElementById('loadBtn')
const pwaBtn       = document.getElementById('pwaBtn')

const STATUS_LABELS = {
  idle:         'Modelo não carregado',
  loading:      'Carregando modelo...',
  ready:        'Pronto — pressione o atalho para gravar',
  transcribing: 'Transcrevendo...',
  error:        'Erro — tente recarregar',
}

// ── Carregar preferências salvas ─────────────────────────────
chrome.storage.local.get(['modelId', 'language'], (prefs) => {
  if (prefs.modelId) modelSelect.value = prefs.modelId
  if (prefs.language) langSelect.value = prefs.language
})

// ── Obter status atual do background ─────────────────────────
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
  if (res) applyStatus(res)
})

// ── Escutar atualizações do background ───────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE') applyStatus(msg)
  if (msg.type === 'MODEL_PROGRESS') {
    progressWrap.style.display = 'block'
    progressBar.value = msg.progress ?? 0
    progressLabel.textContent = `${msg.message ?? ''} (${msg.progress ?? 0}%)`
  }
})

function applyStatus(s) {
  const status = s.modelStatus ?? 'idle'
  statusDot.className = `dot ${status}`
  statusText.textContent = STATUS_LABELS[status] ?? status
  loadBtn.disabled = status === 'loading' || status === 'transcribing'
  loadBtn.textContent = status === 'ready' ? '✓ Modelo Carregado' : '▶ Carregar Modelo'
  if (status === 'ready') {
    progressWrap.style.display = 'none'
  }
}

// ── Botão Carregar Modelo ─────────────────────────────────────
loadBtn.addEventListener('click', () => {
  const modelId  = modelSelect.value
  const language = langSelect.value
  chrome.storage.local.set({ modelId, language })
  chrome.runtime.sendMessage({ type: 'LOAD_MODEL', modelId, language })
  applyStatus({ modelStatus: 'loading' })
})

// ── Salvar preferências ao mudar selects ─────────────────────
modelSelect.addEventListener('change', () => {
  chrome.storage.local.set({ modelId: modelSelect.value })
})
langSelect.addEventListener('change', () => {
  chrome.storage.local.set({ language: langSelect.value })
})

// ── Botão PWA ─────────────────────────────────────────────────
pwaBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://wispr-local.vercel.app' })
})

// ── Links para página de atalhos ──────────────────────────────
document.querySelectorAll('#shortcutsLink, #shortcutsLink2').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault()
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
  })
})
