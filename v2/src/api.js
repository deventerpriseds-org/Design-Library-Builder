export const API_BASE = import.meta.env.VITE_API_BASE || 'https://design-library-builder-api.azurewebsites.net/api'

let _sessionToken = null
try { _sessionToken = sessionStorage.getItem('dlg_session_token') } catch {}

export function setSessionToken(t) {
  _sessionToken = t
  try { t ? sessionStorage.setItem('dlg_session_token', t) : sessionStorage.removeItem('dlg_session_token') } catch {}
}

function authHeaders() {
  return _sessionToken ? { Authorization: `Bearer ${_sessionToken}` } : {}
}

// POST /design-library/extract  — sends images + prompts to Claude, streams JSON
export async function extractDesign({ name, primaryColor, images, urls, description }, onChunk) {
  const body = { name, primaryColor, images, urls, description }
  const res = await fetch(`${API_BASE}/design-library/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `Extract failed: ${res.status}`)
  }
  // Streamed NDJSON — each line is a progress event or the final result
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        if (event.type === 'progress') onChunk?.(event)
        if (event.type === 'result') result = event.data
      } catch { /* partial line */ }
    }
  }
  return result
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
