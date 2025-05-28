import './style.css'
import { createVerifiedFetch } from '@helia/verified-fetch'
import { fileTypeFromBuffer } from 'file-type'

const fetch = await createVerifiedFetch(
  {
    gateways: ['https://trustless-gateway.link'],
    routers: ['http://delegated-ipfs.dev']
  },
  {
    contentTypeParser: async (bytes) => {
      const result = await fileTypeFromBuffer(bytes)
      console.log('Detected type:', result?.mime)
      return result?.mime || 'application/octet-stream'
    }
  }
)

function search() {
  const input = document.querySelector<HTMLInputElement>('input#ipfsHash')?.value
  if (input) searchRaw(input)
}


function showLoading() {
  const appElement = document.querySelector('#app')
  if (appElement) {
    appElement.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8">
        <svg class="animate-spin h-10 w-10 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <span class="text-blue-600 font-medium">Loading...</span>
      </div>
    `
  }
}

async function searchRaw(path: string) {
  console.log('Searching for:', path)
  showLoading()
  const resp = await fetch(path, { redirect: 'follow' })
  await handleResponse(resp, resp.headers.get('content-type'))
}

async function handleResponse(resp: Response, contentType: string | null) {
  console.log('Response:', resp)
  console.log('Content-Type:', contentType)

  const appElement = document.querySelector('#app')
  if (!appElement) return

  let mimeType = contentType
  if (!mimeType) {
    const buffer = await resp.clone().arrayBuffer()
    const detected = await fileTypeFromBuffer(new Uint8Array(buffer))
    mimeType = detected?.mime || 'application/octet-stream'
  }

  try {
    if (isImage(mimeType)) {
      await handleImage(resp, mimeType, appElement)
    } else if (isVideo(mimeType)) {
      await handleVideo(resp, mimeType, appElement)
    } else if (isAudio(mimeType)) {
      await handleAudio(resp, mimeType, appElement)
    } else if (isHTML(mimeType)) {
      await handleHTML(resp, appElement)
    } else if (isText(mimeType)) {
      await handleText(resp, mimeType, appElement)
    } else if (isPDF(mimeType)) {
      await handlePDF(resp, appElement)
    } else if (isArchive(mimeType)) {
      await handleArchive(resp, mimeType, appElement)
    } else if (isJSON(mimeType)) {
      await handleJSON(resp, appElement)
    } else {
      await handleBinary(resp, mimeType, appElement)
    }
  } catch (error: unknown) {
    console.error('Error handling response:', error)
    const message = error instanceof Error ? error.message : String(error)
    appElement.innerHTML = `<div class="text-red-600 font-semibold">Error loading content: ${message}</div>`
  }
}

function isImage(mime: string) {
  return mime.startsWith('image/')
}
function isVideo(mime: string) {
  return mime.startsWith('video/')
}
function isAudio(mime: string) {
  return mime.startsWith('audio/')
}
function isHTML(mime: string) {
  return mime === 'text/html' || mime === 'application/xhtml+xml'
}
function isText(mime: string) {
  return mime.startsWith('text/') && !isHTML(mime)
}
function isPDF(mime: string) {
  return mime === 'application/pdf'
}
function isJSON(mime: string) {
  return mime === 'application/json' || mime === 'text/json'
}
function isArchive(mime: string) {
  return [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-gzip',
    'application/x-tar',
    'application/x-bzip2'
  ].includes(mime)
}

async function handleImage(resp: Response, mime: string, el: Element) {
  const buffer = await resp.arrayBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
  el.innerHTML = `
    <div class="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 class="text-xl font-semibold">Image (${mime})</h3>
      <img src="${url}" alt="Image" class="max-w-full h-auto border border-gray-300 rounded" />
      <p class="text-sm text-gray-600">Size: ${formatBytes(buffer.byteLength)}</p>
      <a href="${url}" download class="text-blue-600 underline">Download</a>
    </div>
  `
}

async function handleVideo(resp: Response, mime: string, el: Element) {
  const buffer = await resp.arrayBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
  el.innerHTML = `
    <div class="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 class="text-xl font-semibold">Video (${mime})</h3>
      <video controls class="max-w-full border border-gray-300 rounded">
        <source src="${url}" type="${mime}" />
        Your browser does not support the video tag.
      </video>
      <p class="text-sm text-gray-600">Size: ${formatBytes(buffer.byteLength)}</p>
      <a href="${url}" download class="text-blue-600 underline">Download</a>
    </div>
  `
}

async function handleAudio(resp: Response, mime: string, el: Element) {
  const buffer = await resp.arrayBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
  el.innerHTML = `
    <div class="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 class="text-xl font-semibold">Audio (${mime})</h3>
      <audio controls class="w-full border border-gray-300 rounded">
        <source src="${url}" type="${mime}" />
        Your browser does not support the audio tag.
      </audio>
      <p class="text-sm text-gray-600">Size: ${formatBytes(buffer.byteLength)}</p>
      <a href="${url}" download class="text-blue-600 underline">Download</a>
    </div>
  `
}

async function handleHTML(resp: Response, el: Element) {
  const html = await resp.text()
  el.innerHTML = `
    <div class="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 class="text-xl font-semibold">HTML Preview</h3>
      <iframe srcdoc="${html.replace(/"/g, '&quot;')}" class="w-full h-[500px] border border-gray-300 rounded"></iframe>
      <details class="text-sm text-gray-600">
        <summary class="cursor-pointer font-medium">View Source</summary>
        <pre class="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">${html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </details>
    </div>
  `
}

async function handleText(resp: Response, mime: string, el: Element) {
  const text = await resp.text()
  el.innerHTML = `
    <div class="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 class="text-xl font-semibold">Text (${mime})</h3>
      <pre class="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      <p class="text-sm text-gray-600">Size: ${formatBytes(new Blob([text]).size)}</p>
    </div>
  `
}

async function handlePDF(resp: Response, el: Element) {
  const buffer = await resp.arrayBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }))
  el.innerHTML = `
    <div class="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 class="text-xl font-semibold">PDF</h3>
      <iframe src="${url}" class="w-full h-[600px] border border-gray-300 rounded"></iframe>
      <p class="text-sm text-gray-600">Size: ${formatBytes(buffer.byteLength)}</p>
      <a href="${url}" download class="text-blue-600 underline">Download PDF</a>
    </div>
  `
}

async function handleArchive(resp: Response, mime: string, el: Element) {
  const buffer = await resp.arrayBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
  const ext = getExtensionFromMime(mime)
  el.innerHTML = `
    <div class="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 class="text-xl font-semibold">Archive (${mime})</h3>
      <p class="text-sm text-gray-600">Size: ${formatBytes(buffer.byteLength)}</p>
      <p class="text-yellow-600">⚠️ Cannot preview archive contents</p>
      <a href="${url}" download="archive.${ext}" class="text-blue-600 underline">Download Archive</a>
    </div>
  `
}

async function handleJSON(resp: Response, el: Element) {
  const text = await resp.text()
  try {
    const json = JSON.parse(text)
    el.innerHTML = `
      <div class="space-y-4 p-4 bg-white rounded-lg shadow">
        <h3 class="text-xl font-semibold">JSON</h3>
        <pre class="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">${JSON.stringify(json, null, 2)}</pre>
        <p class="text-sm text-gray-600">Size: ${formatBytes(new Blob([text]).size)}</p>
      </div>
    `
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    el.innerHTML = `
      <div class="space-y-4 p-4 bg-white rounded-lg shadow">
        <h3 class="text-xl font-semibold text-red-600">Invalid JSON</h3>
        <pre class="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">${text}</pre>
        <p class="text-sm text-gray-600">Error: ${message}</p>
      </div>
    `
  }
}

async function handleBinary(resp: Response, mime: string, el: Element) {
  const buffer = await resp.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const hex = Array.from(bytes.slice(0, 256)).map(b => b.toString(16).padStart(2, '0')).join(' ').match(/.{1,48}/g)?.join('\n') || ''
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }))

  el.innerHTML = `
    <div class="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 class="text-xl font-semibold">Binary (${mime})</h3>
      <p class="text-sm text-gray-600">Size: ${formatBytes(buffer.byteLength)}</p>
      <details class="text-sm text-gray-600">
        <summary class="cursor-pointer font-medium">Hex Preview (first 256 bytes)</summary>
        <pre class="bg-gray-100 p-4 rounded overflow-x-auto font-mono text-xs">${hex}</pre>
      </details>
      <a href="${url}" download class="text-blue-600 underline">Download File</a>
    </div>
  `
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'text/plain': 'txt',
    'text/html': 'html',
    'application/json': 'json'
  }
  return map[mime] || 'bin'
}

// Bind for browser global usage
(window as any).search = search

// Example call
searchRaw('ipfs://bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze/I/Kiwix_logo_v3.svg.png.webp')
