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
 
const resp = await fetch('ipfs://bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze/I/Kiwix_logo_v3.svg.png.webp', {
  redirect: 'follow'
})
 
await handleResponse(resp, resp.headers.get('content-type'))

async function handleResponse(resp: Response, contentType: string | null) {
  console.log("Response:", resp)
  console.log("Content-Type:", contentType)
  
  const appElement = document.querySelector("#app")
  if (!appElement) {
    console.error("App element not found")
    return
  }

  // Fallback to detecting type from response if contentType is null
  let mimeType = contentType
  if (!mimeType) {
    const buffer = await resp.clone().arrayBuffer()
    const detected = await fileTypeFromBuffer(new Uint8Array(buffer))
    mimeType = detected?.mime || 'application/octet-stream'
    console.log("Fallback detected type:", mimeType)
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
  } catch (error) {
    console.error("Error handling response:", error)
    appElement.innerHTML = `<div class="error">Error loading content: ${error.message}</div>`
  }
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

function isVideo(mimeType: string): boolean {
  return mimeType.startsWith('video/')
}

function isAudio(mimeType: string): boolean {
  return mimeType.startsWith('audio/')
}

function isHTML(mimeType: string): boolean {
  return mimeType === 'text/html' || mimeType === 'application/xhtml+xml'
}

function isText(mimeType: string): boolean {
  return mimeType.startsWith('text/') && !isHTML(mimeType)
}

function isPDF(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

function isArchive(mimeType: string): boolean {
  const archiveTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-gzip',
    'application/x-tar',
    'application/x-bzip2'
  ]
  return archiveTypes.includes(mimeType)
}

function isJSON(mimeType: string): boolean {
  return mimeType === 'application/json' || mimeType === 'text/json'
}

async function handleImage(resp: Response, mimeType: string, appElement: Element) {
  const arrayBuffer = await resp.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: mimeType })
  const imageUrl = URL.createObjectURL(blob)
  
  appElement.innerHTML = `
    <div class="content-wrapper">
      <h3>Image (${mimeType})</h3>
      <img src="${imageUrl}" alt="IPFS Image" style="max-width: 100%; height: auto; border: 1px solid #ccc;" />
      <div class="info">
        <p>Size: ${formatBytes(arrayBuffer.byteLength)}</p>
        <a href="${imageUrl}" download="image.${getExtensionFromMime(mimeType)}">Download</a>
      </div>
    </div>
  `
}

async function handleVideo(resp: Response, mimeType: string, appElement: Element) {
  const arrayBuffer = await resp.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: mimeType })
  const videoUrl = URL.createObjectURL(blob)
  
  appElement.innerHTML = `
    <div class="content-wrapper">
      <h3>Video (${mimeType})</h3>
      <video controls style="max-width: 100%; height: auto;">
        <source src="${videoUrl}" type="${mimeType}">
        Your browser does not support the video tag.
      </video>
      <div class="info">
        <p>Size: ${formatBytes(arrayBuffer.byteLength)}</p>
        <a href="${videoUrl}" download="video.${getExtensionFromMime(mimeType)}">Download</a>
      </div>
    </div>
  `
}

async function handleAudio(resp: Response, mimeType: string, appElement: Element) {
  const arrayBuffer = await resp.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: mimeType })
  const audioUrl = URL.createObjectURL(blob)
  
  appElement.innerHTML = `
    <div class="content-wrapper">
      <h3>Audio (${mimeType})</h3>
      <audio controls style="width: 100%;">
        <source src="${audioUrl}" type="${mimeType}">
        Your browser does not support the audio tag.
      </audio>
      <div class="info">
        <p>Size: ${formatBytes(arrayBuffer.byteLength)}</p>
        <a href="${audioUrl}" download="audio.${getExtensionFromMime(mimeType)}">Download</a>
      </div>
    </div>
  `
}

async function handleHTML(resp: Response, appElement: Element) {
  const htmlContent = await resp.text()
  
  appElement.innerHTML = `
    <div class="content-wrapper">
      <h3>HTML Document</h3>
      <div class="html-preview">
        <iframe srcdoc="${htmlContent.replace(/"/g, '&quot;')}" 
                style="width: 100%; height: 500px; border: 1px solid #ccc;">
        </iframe>
      </div>
      <details>
        <summary>View Source</summary>
        <pre><code>${htmlContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      </details>
    </div>
  `
}

async function handleText(resp: Response, mimeType: string, appElement: Element) {
  const textContent = await resp.text()
  
  appElement.innerHTML = `
    <div class="content-wrapper">
      <h3>Text File (${mimeType})</h3>
      <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      <div class="info">
        <p>Size: ${formatBytes(new Blob([textContent]).size)}</p>
      </div>
    </div>
  `
}

async function handlePDF(resp: Response, appElement: Element) {
  const arrayBuffer = await resp.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
  const pdfUrl = URL.createObjectURL(blob)
  
  appElement.innerHTML = `
    <div class="content-wrapper">
      <h3>PDF Document</h3>
      <iframe src="${pdfUrl}" style="width: 100%; height: 600px; border: 1px solid #ccc;">
        <p>Your browser does not support PDFs. <a href="${pdfUrl}">Download the PDF</a>.</p>
      </iframe>
      <div class="info">
        <p>Size: ${formatBytes(arrayBuffer.byteLength)}</p>
        <a href="${pdfUrl}" download="document.pdf">Download PDF</a>
      </div>
    </div>
  `
}

async function handleArchive(resp: Response, mimeType: string, appElement: Element) {
  const arrayBuffer = await resp.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: mimeType })
  const archiveUrl = URL.createObjectURL(blob)
  
  const extension = getExtensionFromMime(mimeType)
  
  appElement.innerHTML = `
    <div class="content-wrapper">
      <h3>Archive File (${mimeType})</h3>
      <div class="archive-info">
        <p>📁 Archive file detected</p>
        <p>Type: ${mimeType}</p>
        <p>Size: ${formatBytes(arrayBuffer.byteLength)}</p>
        <p>⚠️ Archive contents cannot be previewed in browser</p>
      </div>
      <div class="download-section">
        <a href="${archiveUrl}" download="archive.${extension}" class="download-btn">
          📥 Download Archive
        </a>
      </div>
    </div>
  `
}

async function handleJSON(resp: Response, appElement: Element) {
  const jsonText = await resp.text()
  let jsonContent
  
  try {
    jsonContent = JSON.parse(jsonText)
  } catch (e) {
    appElement.innerHTML = `
      <div class="content-wrapper">
        <h3>Invalid JSON</h3>
        <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto;">${jsonText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </div>
    `
    return
  }
  
  appElement.innerHTML = `
    <div class="content-wrapper">
      <h3>JSON Data</h3>
      <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(jsonContent, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      <div class="info">
        <p>Size: ${formatBytes(new Blob([jsonText]).size)}</p>
      </div>
    </div>
  `
}

async function handleBinary(resp: Response, mimeType: string, appElement: Element) {
  const arrayBuffer = await resp.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: mimeType })
  const binaryUrl = URL.createObjectURL(blob)
  
  // Show hex preview for binary files
  const bytes = new Uint8Array(arrayBuffer)
  const hexPreview = Array.from(bytes.slice(0, 256))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ')
    .match(/.{1,48}/g)?.join('\n') || ''
  
  appElement.innerHTML = `
    <div class="content-wrapper">
      <h3>Binary File (${mimeType})</h3>
      <div class="binary-info">
        <p>📄 Binary file detected</p>
        <p>Type: ${mimeType}</p>
        <p>Size: ${formatBytes(arrayBuffer.byteLength)}</p>
      </div>
      <details>
        <summary>Hex Preview (first 256 bytes)</summary>
        <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px;">${hexPreview}</pre>
      </details>
      <div class="download-section">
        <a href="${binaryUrl}" download="file.bin" class="download-btn">
          📥 Download File
        </a>
      </div>
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

function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: { [key: string]: string } = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'text/plain': 'txt',
    'text/html': 'html',
    'application/json': 'json'
  }
  return mimeToExt[mimeType] || 'bin'
}