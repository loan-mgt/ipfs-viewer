import './style.css'
import { createVerifiedFetch } from '@helia/verified-fetch'
import { fileTypeFromBuffer } from 'file-type'

const fetch = await createVerifiedFetch({
  gateways: ['https://trustless-gateway.link'],
  routers: ['http://delegated-ipfs.dev']
}, {
  contentTypeParser: async (bytes) => {
    const result = await fileTypeFromBuffer(bytes)
    console.log("Detected type:", result?.mime)
    return result?.mime || 'application/octet-stream'
  }
})

const appEl = document.querySelector("#app")

document.querySelector("#searchButton")?.addEventListener("click", () => {
  const input = document.querySelector<HTMLInputElement>("#ipfsHash")
  if (input?.value) searchRaw(input.value)
})

async function searchRaw(path: string) {
  if (!appEl) return
  try {
    console.log("Searching for:", path)
    const resp = await fetch(path, { redirect: 'follow' })
    let contentType = resp.headers.get('content-type')
    
    if (!contentType) {
      const buffer = await resp.clone().arrayBuffer()
      contentType = (await fileTypeFromBuffer(new Uint8Array(buffer)))?.mime || 'application/octet-stream'
    }

    await handleResponse(resp, contentType)
  } catch (err) {
    console.error("Search error:", err)
    appEl.innerHTML = `<div class="text-red-600 font-semibold">Error: ${err.message}</div>`
  }
}

async function handleResponse(resp: Response, mime: string) {
  if (!appEl) return

  try {
    switch (true) {
      case isImage(mime): return renderMedia(resp, mime, 'Image', 'img', appEl)
      case isVideo(mime): return renderMedia(resp, mime, 'Video', 'video', appEl)
      case isAudio(mime): return renderMedia(resp, mime, 'Audio', 'audio', appEl)
      case isHTML(mime): return renderHTML(resp, appEl)
      case isText(mime): return renderText(resp, mime, appEl)
      case isPDF(mime): return renderPDF(resp, appEl)
      case isArchive(mime): return renderArchive(resp, mime, appEl)
      case isJSON(mime): return renderJSON(resp, appEl)
      default: return renderBinary(resp, mime, appEl)
    }
  } catch (err) {
    console.error("Render error:", err)
    appEl.innerHTML = `<div class="text-red-600 font-semibold">Render Error: ${err.message}</div>`
  }
}

// Utility predicates
const isImage = (m: string) => m.startsWith('image/')
const isVideo = (m: string) => m.startsWith('video/')
const isAudio = (m: string) => m.startsWith('audio/')
const isHTML = (m: string) => ['text/html', 'application/xhtml+xml'].includes(m)
const isText = (m: string) => m.startsWith('text/') && !isHTML(m)
const isPDF = (m: string) => m === 'application/pdf'
const isJSON = (m: string) => ['application/json', 'text/json'].includes(m)
const isArchive = (m: string) => [
  'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
  'application/x-7z-compressed', 'application/gzip', 'application/x-gzip',
  'application/x-tar', 'application/x-bzip2'
].includes(m)

// Media Renderer
async function renderMedia(resp: Response, mime: string, label: string, tag: 'img' | 'video' | 'audio', el: Element) {
  const buffer = await resp.arrayBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
  const tagHtml = tag === 'img'
    ? `<img src="${url}" alt="${label}" class="max-w-full h-auto border rounded" />`
    : `<${tag} controls class="w-full border rounded"><source src="${url}" type="${mime}" /></${tag}>`

  el.innerHTML = template(label, mime, buffer.byteLength, `${tagHtml}<a href="${url}" download class="text-blue-600 underline">Download</a>`)
}

async function renderHTML(resp: Response, el: Element) {
  const html = await resp.text()
  el.innerHTML = `
    <div class="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 class="text-xl font-semibold">HTML Preview</h3>
      <iframe srcdoc="${html.replace(/"/g, '&quot;')}" class="w-full h-[500px] border rounded"></iframe>
      <details class="text-sm text-gray-600"><summary>View Source</summary>
        <pre class="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">${escapeHTML(html)}</pre>
      </details>
    </div>
  `
}

async function renderText(resp: Response, mime: string, el: Element) {
  const text = await resp.text()
  el.innerHTML = template(`Text (${mime})`, mime, new Blob([text]).size,
    `<pre class="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">${escapeHTML(text)}</pre>`)
}

async function renderPDF(resp: Response, el: Element) {
  const buffer = await resp.arrayBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }))
  el.innerHTML = template('PDF', 'application/pdf', buffer.byteLength,
    `<iframe src="${url}" class="w-full h-[600px] border rounded"></iframe><a href="${url}" download class="text-blue-600 underline">Download PDF</a>`)
}

async function renderArchive(resp: Response, mime: string, el: Element) {
  const buffer = await resp.arrayBuffer()
  const ext = getExtensionFromMime(mime)
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
  el.innerHTML = template(`Archive (${mime})`, mime, buffer.byteLength,
    `<p class="text-yellow-600">⚠️ Cannot preview archive contents</p><a href="${url}" download="archive.${ext}" class="text-blue-600 underline">Download Archive</a>`)
}

async function renderJSON(resp: Response, el: Element) {
  const text = await resp.text()
  try {
    const json = JSON.parse(text)
    el.innerHTML = template('JSON', 'application/json', new Blob([text]).size,
      `<pre class="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">${JSON.stringify(json, null, 2)}</pre>`)
  } catch {
    el.innerHTML = template('Invalid JSON', 'text/plain', text.length,
      `<pre class="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">${escapeHTML(text)}</pre>`)
  }
}

async function renderBinary(resp: Response, mime: string, el: Element) {
  const buffer = await resp.arrayBuffer()
  const hex = Array.from(new Uint8Array(buffer.slice(0, 256)))
    .map(b => b.toString(16).padStart(2, '0')).join(' ')
    .match(/.{1,48}/g)?.join('\n') || ''
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
  el.innerHTML = template(`Binary (${mime})`, mime, buffer.byteLength,
    `<details><summary>Hex Preview</summary><pre class="bg-gray-100 p-4 rounded overflow-x-auto font-mono text-xs">${hex}</pre></details>
     <a href="${url}" download class="text-blue-600 underline">Download</a>`)
}

// Helpers
const template = (label: string, mime: string, size: number, inner: string) => `
  <div class="space-y-4 p-4 bg-white rounded-lg shadow">
    <h3 class="text-xl font-semibold">${label}</h3>
    ${inner}
    <p class="text-sm text-gray-600">Size: ${formatBytes(size)}</p>
  </div>
`

const escapeHTML = (str: string) =>
  str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function formatBytes(bytes: number): string {
  if (!bytes) return '0 Bytes'
  const units = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

function getExtensionFromMime(mime: string): string {
  return ({
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'application/pdf': 'pdf',
    'application/zip': 'zip', 'application/x-7z-compressed': '7z',
    'text/plain': 'txt', 'text/html': 'html', 'application/json': 'json'
  } as Record<string, string>)[mime] || 'bin'
}

// Auto-load default hash
searchRaw('ipfs://bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze/I/Kiwix_logo_v3.svg.png.webp')
