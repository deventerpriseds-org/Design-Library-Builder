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

// POST /design-library/extract — waits for full result (synchronous, no streaming)
export async function extractDesign({ name, primaryColor, images, urls, description }, _onChunk) {
  const res = await fetch(`${API_BASE}/design-library/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, primaryColor, images, urls, description }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Extract failed: ${res.status}`)
  return data
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
