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

// POST /design-library/extract → job ID, then poll GET /design-library/status/{id}
export async function extractDesign({ name, primaryColor, images, urls, description }, onChunk) {
  // Start the job
  const startRes = await fetch(`${API_BASE}/design-library/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, primaryColor, images, urls, description }),
  })
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}))
    throw new Error(err?.error || `Extract failed: ${startRes.status}`)
  }
  const { jobId } = await startRes.json()

  // Poll until done
  const POLL_MS = 2000
  while (true) {
    await new Promise(r => setTimeout(r, POLL_MS))
    const pollRes = await fetch(`${API_BASE}/design-library/status/${jobId}`, { headers: authHeaders() })
    if (!pollRes.ok) throw new Error(`Status check failed: ${pollRes.status}`)
    const data = await pollRes.json()
    if (data.status === 'running') {
      onChunk?.({ type: 'heartbeat', phase: data.phase, elapsed: data.elapsed })
    } else if (data.status === 'error') {
      throw new Error(data.error || 'Extraction failed')
    } else if (data.status === 'done') {
      return data.result
    }
  }
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
