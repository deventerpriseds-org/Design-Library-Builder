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

// POST /design-library/extract-async → poll GET /design-library/extract-job/:id
// The sync endpoint (?sync=1) holds the connection open until Anthropic finishes — real images
// hit Azure's gateway timeout and the browser gets "Failed to fetch". The async path returns
// a jobId immediately; the queue worker processes extraction independently of the HTTP connection.
export async function extractDesign({ name, primaryColor, images, urls, description }, onChunk) {
  const body = { name, primaryColor, images, urls, description }
  onChunk?.({ type: 'progress', category: 'extracting', message: 'Queuing extraction…', done: false })

  // Step 1: enqueue
  const enqRes = await fetch(`${API_BASE}/design-library/extract-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!enqRes.ok) {
    const err = await enqRes.json().catch(() => ({}))
    throw new Error(err?.error || `Extract failed: ${enqRes.status}`)
  }
  const { jobId } = await enqRes.json()
  if (!jobId) throw new Error('No jobId returned from extract-async')

  onChunk?.({ type: 'progress', category: 'extracting', message: 'Analysing design…', done: false })

  // Step 2: poll until done (up to 3 min, 4 s interval)
  const MAX_POLLS = 45
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, 4000))
    const pollRes = await fetch(`${API_BASE}/design-library/extract-job/${jobId}`, { headers: authHeaders() })
    if (!pollRes.ok) continue
    const poll = await pollRes.json()
    if (poll.status === 'done') {
      if (!poll.result) throw new Error('Job completed but no result returned')
      onChunk?.({ type: 'progress', category: 'finalizing', message: 'Extraction complete', done: true })
      return poll.result
    }
    if (poll.status === 'error') throw new Error(poll.error || 'Extraction failed on the server')
    // still pending — emit progress tick
    const elapsed = (i + 1) * 4
    onChunk?.({ type: 'progress', category: 'extracting', message: `Analysing design… ${elapsed}s`, done: false })
  }
  throw new Error('Extraction timed out after 3 minutes — try a smaller image')
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
