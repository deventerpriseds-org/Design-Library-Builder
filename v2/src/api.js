export const API_BASE = import.meta.env.VITE_API_BASE || 'https://design-library-builder-api.azurewebsites.net/api'

let _sessionToken = null
try { _sessionToken = sessionStorage.getItem('dlg_session_token') } catch {}

export function setSessionToken(t) {
  _sessionToken = t
  try { t ? sessionStorage.setItem('dlg_session_token', t) : sessionStorage.removeItem('dlg_session_token') } catch {}
}

const UAT_BYPASS_LS_KEY = 'dlg_uat_bypass_token'

function authHeaders() {
  if (_sessionToken) return { Authorization: `Bearer ${_sessionToken}` }
  try {
    const uatToken = localStorage.getItem(UAT_BYPASS_LS_KEY)
    if (uatToken) return { 'X-UAT-Token': uatToken }
  } catch {}
  return {}
}

// POST /design-library/extract — streams NDJSON progress events, returns design system when done.
// The streaming connection stays alive (progress events flow every few seconds), preventing
// network proxy timeouts that killed the previous sync (?sync=1) approach.
// The original streaming approach failed only because max_tokens was 4096 (now 16000).
export async function extractDesign({ name, primaryColor, images, urls, description }, onChunk) {
  const body = { name, primaryColor, images, urls, description }
  onChunk?.({ type: 'progress', category: 'extracting', message: 'Analysing design…', done: false })

  const res = await fetch(`${API_BASE}/design-library/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `Extract failed: ${res.status}`)
  }

  // Read NDJSON stream — each line is a JSON event
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let finalResult = null
  let lastError = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() // keep incomplete line in buffer
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const evt = JSON.parse(line)
        if (evt.type === 'result') {
          finalResult = evt.data
        } else if (evt.type === 'progress') {
          onChunk?.(evt)
          if (evt.category === 'error') lastError = evt.message || lastError
        }
      } catch { /* partial line */ }
    }
  }

  if (!finalResult) {
    throw new Error(lastError || 'Extraction returned no result — check network connection and try again')
  }
  onChunk?.({ type: 'progress', category: 'finalizing', message: 'Extraction complete', done: true })
  return finalResult
}

// GET /design-library/saved  — list user's saved design systems
export async function listDesignSystems() {
  const res = await fetch(`${API_BASE}/design-library/saved`, { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

// POST /design-library/save  — persist a design system for the user
export async function saveDesignSystem(system) {
  const res = await fetch(`${API_BASE}/design-library/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(system),
  })
  if (!res.ok) throw new Error(`Save failed: ${res.status}`)
  return res.json()
}

// GET /design-library/palettes  — list org color palettes
export async function listPalettes(orgId = 'default') {
  const res = await fetch(`${API_BASE}/design-library/palettes?org=${encodeURIComponent(orgId)}`, { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

// POST /design-library/palettes  — save a color palette
export async function savePalette(palette) {
  const res = await fetch(`${API_BASE}/design-library/palettes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(palette),
  })
  if (!res.ok) throw new Error(`Palette save failed: ${res.status}`)
  return res.json()
}

// POST /design-library/upload  — upload an image file, returns { url } SAS URL
// Avoids embedding large base64 blobs in the extract payload (causes 502s via proxy).
export async function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/design-library/upload`, {
    method: 'POST',
    headers: authHeaders(), // no Content-Type — browser sets multipart boundary
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `Upload failed: ${res.status}`)
  }
  return res.json() // { url, blobName }
}

// POST /design-library/push-figma  — push design system to Figma
export async function pushToFigma({ result, figmaFileId, figmaToken, syncStorybook = true, syncSupernova = true }) {
  const res = await fetch(`${API_BASE}/design-library/push-figma`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ result, figmaFileId, figmaToken, syncStorybook, syncSupernova }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `Push failed: ${res.status}`)
  }
  return res.json()
}

// POST /design-library/patch-figma  — apply tweak to Figma file
export async function patchFigma({ figmaFileId, figmaToken, patch }) {
  const res = await fetch(`${API_BASE}/design-library/patch-figma`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ figmaFileId, figmaToken, patch }),
  })
  if (!res.ok) return { ok: false }
  return res.json()
}

// POST /design-library/stories  — generate story files for components
export async function generateStories(result) {
  const res = await fetch(`${API_BASE}/design-library/stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ result }),
  })
  if (!res.ok) return { stories: [] }
  return res.json()
}

// POST /design-library/commit-stories  — commit story files to repo → triggers Storybook build
export async function commitStories({ stories, libraryName }) {
  const res = await fetch(`${API_BASE}/design-library/commit-stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ stories, libraryName }),
  })
  if (!res.ok) return { committed: [], failed: stories.map(s => s.filename), triggersWorkflow: false }
  return res.json()
}
