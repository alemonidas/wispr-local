// scripts/build-extension.js
// Compila a extensão Chrome para a pasta extension/dist/
// Uso: node scripts/build-extension.js

import { build } from 'esbuild'
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC  = join(ROOT, 'extension')
const DIST = join(ROOT, 'extension', 'dist')

// Limpa / cria dist
mkdirSync(join(DIST, 'popup'), { recursive: true })
mkdirSync(join(DIST, 'icons'), { recursive: true })

console.log('Building VoiceFlow Extension...\n')

// 1. Bundle offscreen.js (Transformers.js + Whisper pipeline)
console.log('  [1/4] Bundling offscreen.js (Whisper)...')
await build({
  entryPoints: [join(SRC, 'offscreen.js')],
  bundle: true,
  format: 'esm',
  outfile: join(DIST, 'offscreen.js'),
  platform: 'browser',
  target: ['chrome116'],
  external: ['chrome'],
  // Evita inline de modelos WASM como base64
  loader: { '.wasm': 'file' },
  assetNames: 'assets/[name]-[hash]',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
})

// 2. Copiar arquivos que não precisam de bundle
console.log('  [2/4] Copying static files...')

const staticFiles = [
  ['manifest.json', 'manifest.json'],
  ['background.js', 'background.js'],
  ['content.js', 'content.js'],
  ['offscreen.html', 'offscreen.html'],
  ['popup/popup.html', 'popup/popup.html'],
  ['popup/popup.js', 'popup/popup.js'],
]

for (const [src, dst] of staticFiles) {
  copyFileSync(join(SRC, src), join(DIST, dst))
}

// 3. Gerar ícones SVG → PNG (usa Canvas API via script inline)
console.log('  [3/4] Generating icons...')
generateIcons()

// 4. Resumo
console.log('\n  [4/4] Done!')
console.log(`\n  ✓ Extension built at: ${DIST}`)
console.log('\n  Como instalar:')
console.log('  1. Abra chrome://extensions/')
console.log('  2. Ative "Modo desenvolvedor" (canto superior direito)')
console.log('  3. Clique "Carregar sem compactação"')
console.log(`  4. Selecione a pasta: ${DIST}`)
console.log('  5. Configure o atalho em chrome://extensions/shortcuts\n')

function generateIcons() {
  // Gera ícones simples como SVG inline
  const sizes = [16, 48, 128]
  for (const size of sizes) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#1a1a2e"/>
  <text x="50" y="68" text-anchor="middle" font-size="60" font-family="Segoe UI Emoji">🎙</text>
</svg>`
    // Salva como SVG (Chrome aceita SVG como ícone de extensão)
    writeFileSync(join(DIST, 'icons', `icon${size}.svg`), svg)
  }

  // Atualiza manifest para usar .svg nos ícones
  const manifestPath = join(DIST, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const iconMap = {}
  for (const size of sizes) {
    iconMap[String(size)] = `icons/icon${size}.svg`
  }
  manifest.icons = iconMap
  manifest.action.default_icon = iconMap
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}
