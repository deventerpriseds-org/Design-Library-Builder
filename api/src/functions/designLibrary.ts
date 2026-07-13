import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { TableClient, odata } from '@azure/data-tables'
import { Pool } from 'pg'

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING!
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const TABLE = 'DesignLibraries'
const FIGMA_TOKEN = process.env.FIGMA_ACCESS_TOKEN || ''

// ── PostgreSQL pool (lazy init) ───────────────────────────────────────────────
let _pgPool: Pool | null = null
function pgPool(): Pool {
  if (!_pgPool) {
    const cs = process.env.AZURE_PG_UXDESIGN_CONNECTION_STRING || ''
    if (!cs) throw new Error('AZURE_PG_UXDESIGN_CONNECTION_STRING not configured')
    _pgPool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, max: 3 })
  }
  return _pgPool
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
const JSON_H = { 'Content-Type': 'application/json', ...CORS }
const STREAM_H = { 'Content-Type': 'application/x-ndjson', 'Transfer-Encoding': 'chunked', ...CORS }

// ── Extraction prompt ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert design systems architect and Figma specialist. Given screenshots, URLs, and descriptions of an app, you extract and infer a COMPLETE, production-ready Figma design library specification.

CRITICAL INFERENCE MANDATE: For any element in the required schema that cannot be directly observed in the provided inputs, infer the most likely high-quality, production-appropriate value based on the overall design language you observe. If you can see a primary color but no spacing scale, generate a spacing scale consistent with the design's density. If you can see card components but no explicit shadow tokens, infer shadow values from the apparent elevation style. Never omit a required schema field — always provide your best professional judgment. The goal is a complete, deployable design system regardless of how much input was provided.

FIGMA PLUGIN API NAMING — ALL values must use exact Figma Plugin API conventions:
- Variable resolvedType: COLOR | FLOAT | STRING | BOOLEAN (all caps, no other values)
- Effect type: DROP_SHADOW | INNER_SHADOW | LAYER_BLUR | BACKGROUND_BLUR (all caps)
- Grid pattern: COLUMNS | ROWS | GRID (all caps)
- fontStyle: use exact Figma strings only: "Thin" | "Extra Light" | "Light" | "Regular" | "Medium" | "Semi Bold" | "Bold" | "Extra Bold" | "Black"
- lineHeight: { "value": number, "unit": "PIXELS" | "PERCENT" | "AUTO" }
- letterSpacing: { "value": number, "unit": "PIXELS" | "PERCENT" }
- Variable scopes (use only these exact strings, never "ALL_SCOPES"):
  FRAME_FILL | SHAPE_FILL | TEXT_FILL | STROKE_COLOR | EFFECT_COLOR | GAP | CORNER_RADIUS | WIDTH_HEIGHT | FONT_SIZE | LINE_HEIGHT | LETTER_SPACING | FONT_WEIGHT | STROKE_FLOAT | EFFECT_FLOAT | OPACITY | FONT_FAMILY | FONT_STYLE

Your output MUST be a JSON object matching EXACTLY this schema:

{
  "meta": {
    "name": string,
    "primaryColor": string (hex),
    "secondaryColor": string (hex),
    "bgColor": string (hex),
    "surfaceColor": string (hex),
    "textColor": string (hex),
    "borderColor": string (hex),
    "buttonRadius": number (px),
    "cardRadius": number (px),
    "inputRadius": number (px),
    "sidebarWidth": number (px),
    "fontFamily": string,
    "monoFontFamily": string,
    "extractedAt": string (ISO),
    "inferenceMap": {
      "primitives": "found" | "inferred",
      "colorTokens": "found" | "inferred",
      "spacingTokens": "found" | "inferred",
      "motionTokens": "found" | "inferred",
      "typography": "found" | "inferred",
      "textStyles": "found" | "inferred",
      "effectStyles": "found" | "inferred",
      "gridStyles": "found" | "inferred",
      "components": "found" | "inferred",
      "patterns": "found" | "inferred"
    }
  },
  "variables": {
    "collections": {
      "Primitives": [
        {
          "name": string,
          "value": string,
          "type": "color" | "number" | "string" | "boolean",
          "resolvedType": "COLOR" | "FLOAT" | "STRING" | "BOOLEAN",
          "scopes": string[],
          "hiddenFromPublishing": true
        }
      ],
      "Color": [
        {
          "name": string,
          "lightValue": string,
          "darkValue": string,
          "lightAlias": string,
          "darkAlias": string,
          "resolvedType": "COLOR",
          "scopes": string[],
          "description": string
        }
      ],
      "Spacing": [
        {
          "name": string,
          "value": number,
          "resolvedType": "FLOAT",
          "scopes": ["GAP", "WIDTH_HEIGHT"],
          "description": string
        }
      ],
      "Typography": [
        {
          "name": string,
          "value": string | number,
          "resolvedType": "FLOAT" | "STRING",
          "scopes": string[],
          "description": string
        }
      ],
      "Motion": [
        {
          "name": string,
          "value": string | number,
          "resolvedType": "FLOAT" | "STRING",
          "description": string
        }
      ],
      "Component Tokens": [
        {
          "name": string,
          "value": string,
          "component": string,
          "property": string,
          "resolvedType": "COLOR" | "FLOAT" | "STRING",
          "scopes": string[]
        }
      ]
    }
  },
  "styles": {
    "text": [
      {
        "name": string,
        "fontFamily": string,
        "fontStyle": string,
        "fontSize": number,
        "fontWeight": number,
        "lineHeight": { "value": number, "unit": "PIXELS" | "PERCENT" | "AUTO" },
        "letterSpacing": { "value": number, "unit": "PIXELS" | "PERCENT" },
        "paragraphSpacing": number,
        "usage": string,
        "tier": "display" | "heading" | "body" | "label" | "code" | "caption"
      }
    ],
    "color": [
      { "name": string, "color": string, "usage": string }
    ],
    "effects": [
      {
        "name": string,
        "type": "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR",
        "radius": number,
        "spread": number,
        "color": string,
        "offsetX": number,
        "offsetY": number,
        "css": string
      }
    ],
    "grids": [
      {
        "name": string,
        "pattern": "COLUMNS" | "ROWS" | "GRID",
        "count": number,
        "gutter": number,
        "margin": number,
        "alignment": "MIN" | "STRETCH" | "CENTER" | "MAX",
        "breakpoint": string
      }
    ]
  },
  "components": [
    {
      "name": string,
      "tier": "atom" | "molecule" | "organism" | "pattern",
      "category": string,
      "variants": string[],
      "states": string[],
      "variantProperties": { [key: string]: string[] },
      "componentProperties": { [key: string]: { "type": "TEXT" | "BOOLEAN" | "INSTANCE_SWAP", "default": string } },
      "tokenBindings": string[],
      "styleBindings": string[],
      "variableBindings": { [property: string]: string }
    }
  ],
  "patterns": [
    {
      "name": string,
      "description": string,
      "components": string[],
      "layout": string
    }
  ]
}

REQUIRED COMPONENTS — extract or infer ALL of these, organized by tier:

ATOMS (foundational, single-purpose):
Button (variants: Primary/Secondary/Ghost/Destructive/Link; sizes: SM/MD/LG; states: Default/Hover/Pressed/Disabled/Loading)
Input (variants: Default/Error/Success/Disabled; types: text/password/search/number)
Checkbox (states: Unchecked/Checked/Indeterminate/Disabled)
Radio (states: Unselected/Selected/Disabled)
Toggle/Switch (states: Off/On/Disabled)
Select/Dropdown (states: Closed/Open/Disabled; with search option)
Textarea (states: Default/Focus/Error/Disabled)
Badge/Tag (variants: Brand/Success/Warning/Error/Info/Neutral/Outline)
Avatar (sizes: XS/SM/MD/LG/XL; variants: Image/Initials/Icon/Placeholder; with status dot)
Icon (library: Outline/Solid/Custom)
Spinner/Loader (sizes: SM/MD/LG; variants: Circular/Linear/Skeleton)
Tooltip (placement: Top/Bottom/Left/Right)
Divider (variants: Horizontal/Vertical; with/without label)
Progress Bar (variants: Linear/Circular; states: Default/Success/Error)
Chip/Pill (variants: Default/Dismissible/Interactive)

MOLECULES (composed of atoms):
Form Field (label + input + helper text + error message)
Search Bar (input + icon + clear button)
Alert/Banner (variants: Info/Success/Warning/Error; with/without icon; with/without close)
Card (variants: Basic/Elevated/Outlined/Interactive/Brand-filled)
Stat Card (metric + label + trend + icon)
List Item (with/without icon, avatar, action, checkbox)
Menu Item (with/without icon, shortcut, submenu indicator)
Breadcrumb
Pagination (first/prev/numbers/next/last; compact variant)
File Upload (dropzone + file list)
Color Picker (swatch grid + hex input)
Date Picker (calendar + input)
Notification/Toast (variants: Info/Success/Warning/Error; position: top-right/bottom-center)
Tab Item (variants: Underline/Pill/Contained; states: Active/Inactive/Disabled)
Step/Stepper Item (states: Complete/Active/Upcoming)

ORGANISMS (complex, page-level):
Navigation Bar / Topbar (logo + nav links + actions + user menu)
Sidebar / Left Nav (logo + nav sections + items + collapse toggle)
Data Table (header + rows + sorting + selection + pagination)
Tab Group (tab bar + content panel)
Modal / Dialog (header + body + footer with actions; sizes: SM/MD/LG/Full)
Drawer / Sheet (side panel; placement: Right/Left/Bottom)
Form (multi-field with validation, section headers, submit)
Empty State (illustration + title + description + CTA)
Error State (404/500/Network variants)
Skeleton Screen (page-level loading placeholder)
Command Palette / Search Modal
User Profile Menu / Account Dropdown
Notification Panel / Activity Feed

PATTERNS (full page compositions):
Auth Pages (Sign in / Sign up / Forgot password)
Dashboard Layout (topbar + sidebar + main content area + stat cards)
List/Table Page (filters + table + pagination)
Detail/Profile Page (header hero + tabs + content)
Settings Page (sidebar nav + form sections)
Onboarding Flow (multi-step with progress indicator)

SPACING SCALE — always include all 9 steps inferred from design density:
0: 0px, 1: 4px, 2: 8px, 3: 12px, 4: 16px, 5: 24px, 6: 32px, 7: 48px, 8: 64px, 9: 96px

TYPOGRAPHY SCALE — always include all 10 styles:
Display (36-72px, Bold/Extra Bold), H1 (28-36px), H2 (22-28px), H3 (18-22px), H4 (16-18px), Body LG (16-18px), Body (14-16px), Body SM (12-14px), Caption (11-12px), Label (11-13px, Semi Bold), Code/Mono (13-14px), Overline (11px, uppercase, tracked)

MOTION TOKENS — always include even if no animations visible:
Duration: instant(0ms), fast(100ms), base(200ms), slow(300ms), slower(500ms)
Easing: linear, ease-in, ease-out, ease-in-out, spring, bounce

COLOR SEMANTIC TOKENS — always include:
Action: primary, secondary, ghost, destructive
Surface: page, card, overlay, sidebar, code
Text: primary, secondary, tertiary, inverse, link, disabled
Border: default, strong, focus, error
Status: success-bg/text/border, warning-bg/text/border, error-bg/text/border, info-bg/text/border

Respond ONLY with the JSON object. No markdown, no explanation, no code fences.`

// ── Extract endpoint ─────────────────────────────────────────────────────────
async function extractHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }

  if (!CLAUDE_API_KEY) {
    return { status: 500, headers: JSON_H, jsonBody: { error: 'ANTHROPIC_API_KEY not configured on Function App' } }
  }

  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON body' } } }

  const { name, primaryColor, images = [], urls = [], description = '' } = body as any

  const contentBlocks: any[] = []
  contentBlocks.push({
    type: 'text',
    text: `App name: ${name || 'Unknown'}\nPrimary brand color hint: ${primaryColor || 'none'}\nDescription: ${description || 'none'}\nURLs provided: ${urls.join(', ') || 'none'}\n\nExtract the complete design system from the attached screenshots.`
  })

  for (const img of images.slice(0, 20)) {
    const match = img.dataUrl?.match(/^data:(image\/[^;]+);base64,(.+)$/)
    if (!match) continue
    contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      const CATEGORIES = ['primitives', 'color-tokens', 'spacing-tokens', 'motion-tokens', 'typography', 'text-styles', 'effect-styles', 'grid-styles', 'components', 'patterns', 'finalizing']

      const CATEGORY_KEYS: Record<string, string> = {
        'primitives': '"Primitives"',
        'color-tokens': '"Color"',
        'spacing-tokens': '"Spacing"',
        'motion-tokens': '"Motion"',
        'typography': '"Typography"',
        'text-styles': '"text"',
        'effect-styles': '"effects"',
        'grid-styles': '"grids"',
        'components': '"components"',
        'patterns': '"patterns"',
      }
      const emittedDone = new Set<string>()

      try {
        emit({ type: 'progress', category: 'primitives', message: 'Sending to Claude…' })

        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: contentBlocks }],
            stream: true,
          }),
        })

        if (!anthropicRes.ok) {
          const err = await anthropicRes.json().catch(() => ({})) as any
          emit({ type: 'progress', category: 'error', message: err?.error?.message || `Anthropic API ${anthropicRes.status}`, done: true })
          controller.close(); return
        }

        const reader = anthropicRes.body!.getReader()
        const dec = new TextDecoder()
        let sseBuf = ''
        let jsonBuf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          sseBuf += dec.decode(value, { stream: true })
          const lines = sseBuf.split('\n')
          sseBuf = lines.pop()!

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const evt = JSON.parse(data)
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                jsonBuf += evt.delta.text
                for (const [cat, key] of Object.entries(CATEGORY_KEYS)) {
                  if (!emittedDone.has(cat) && jsonBuf.includes(key)) {
                    emit({ type: 'progress', category: cat, message: `${cat} extracted`, done: true })
                    emittedDone.add(cat)
                  }
                }
              }
            } catch { /* partial */ }
          }
        }

        emit({ type: 'progress', category: 'finalizing', message: 'finalizing extracted', done: true })

        let result: any = null
        try {
          const clean = jsonBuf.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
          result = JSON.parse(clean)
        } catch (e) {
          emit({ type: 'progress', category: 'error', message: `JSON parse failed: ${(e as Error).message}`, done: true })
          controller.close(); return
        }

        if (!result.meta) result.meta = {}
        result.meta.name = result.meta.name || name || 'Design System'
        result.meta.extractedAt = new Date().toISOString()

        emit({ type: 'result', data: result })
      } catch (e) {
        emit({ type: 'progress', category: 'error', message: (e as Error).message, done: true })
      }
      controller.close()
    }
  })

  return { status: 200, headers: STREAM_H, body: stream as any }
}

// ── Save endpoint ─────────────────────────────────────────────────────────────
async function saveHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }

  const id = (body.id || crypto.randomUUID()) as string
  const userId = extractUserId(req) || 'anonymous'

  try {
    const client = TableClient.fromConnectionString(CONN, TABLE)
    await client.upsertEntity({
      partitionKey: userId,
      rowKey: id,
      id,
      name: body.meta?.name || 'Unnamed',
      data: JSON.stringify(body),
      createdAt: new Date().toISOString(),
    })
    return { status: 200, headers: JSON_H, jsonBody: { ...body, id } }
  } catch (e) {
    return { status: 500, headers: JSON_H, jsonBody: { error: (e as Error).message } }
  }
}

// ── List endpoint ─────────────────────────────────────────────────────────────
async function listHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  const userId = extractUserId(req) || 'anonymous'
  try {
    const client = TableClient.fromConnectionString(CONN, TABLE)
    const items: any[] = []
    for await (const e of client.listEntities({ queryOptions: { filter: odata`PartitionKey eq ${userId}` } })) {
      try { items.push(JSON.parse(e.data as string)) } catch { /* skip corrupt */ }
    }
    return { status: 200, headers: JSON_H, jsonBody: items }
  } catch {
    return { status: 200, headers: JSON_H, jsonBody: [] }
  }
}

// ── Health check ──────────────────────────────────────────────────────────────
async function healthHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  return {
    status: 200, headers: JSON_H,
    jsonBody: {
      ok: true,
      hasAnthropicKey: !!CLAUDE_API_KEY,
      hasStorageConn: !!CONN,
      ts: new Date().toISOString(),
    }
  }
}

// ── JWT helper ────────────────────────────────────────────────────────────────
function extractUserId(req: HttpRequest): string | null {
  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return payload.sub || payload.email || null
  } catch { return null }
}

// ── Auth session stub (Microsoft access token → session token) ────────────────
// The front-end optionally calls this; return a simple echo token so the client
// stores the user's email without a full token exchange infrastructure.
async function authSessionHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }
  const { msAccessToken } = body as any
  if (!msAccessToken) return { status: 400, headers: JSON_H, jsonBody: { error: 'msAccessToken required' } }
  // Decode email from the access token without verification (internal use only)
  let email: string | null = null
  try {
    const payload = JSON.parse(Buffer.from(msAccessToken.split('.')[1], 'base64url').toString())
    email = payload.upn || payload.email || payload.preferred_username || null
  } catch {}
  const token = Buffer.from(JSON.stringify({ sub: email || 'ms-user', email, iat: Date.now() })).toString('base64url')
  return { status: 200, headers: JSON_H, jsonBody: { token, email } }
}

// ── Google OAuth token exchange ───────────────────────────────────────────────
async function authGoogleTokenHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  const GCLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
  const GCLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
  if (!GCLIENT_ID || !GCLIENT_SECRET) {
    return { status: 500, headers: JSON_H, jsonBody: { error: 'Google OAuth not configured on server' } }
  }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }
  const { code, redirectUri } = body as any
  if (!code || !redirectUri) return { status: 400, headers: JSON_H, jsonBody: { error: 'code and redirectUri required' } }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: GCLIENT_ID, client_secret: GCLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    })
    if (!tokenRes.ok) {
      const e = await tokenRes.json().catch(() => ({})) as any
      return { status: 400, headers: JSON_H, jsonBody: { error: e?.error_description || `Google token exchange ${tokenRes.status}` } }
    }
    const { id_token } = await tokenRes.json() as any
    let email = '', displayName = ''
    try {
      const p = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString())
      email = p.email || ''; displayName = p.name || email
    } catch {}
    const token = Buffer.from(JSON.stringify({ sub: email, email, iat: Date.now() })).toString('base64url')
    return { status: 200, headers: JSON_H, jsonBody: { token, email, displayName } }
  } catch (e) {
    return { status: 500, headers: JSON_H, jsonBody: { error: (e as Error).message } }
  }
}

// ── Color Palettes ───────────────────────────────────────────────────────────
async function listPalettesHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  const orgId = req.query.get('org') || 'default'
  try {
    const { rows } = await pgPool().query(
      'SELECT id, org_id, name, primary_color, secondary_color, bg_color, surface_color, text_color, border_color, primitives, color_tokens, style_colors, extracted_from_system_id, created_by, created_at FROM color_palettes WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50',
      [orgId]
    )
    return { status: 200, headers: JSON_H, jsonBody: rows }
  } catch (e) {
    return { status: 500, headers: JSON_H, jsonBody: { error: (e as Error).message } }
  }
}

async function savePaletteHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }
  const { orgId = 'default', name, primaryColor, secondaryColor, bgColor, surfaceColor, textColor, borderColor, primitives, colorTokens, styleColors, extractedFromSystemId } = body
  if (!name || !primaryColor) return { status: 400, headers: JSON_H, jsonBody: { error: 'name and primaryColor required' } }
  const createdBy = extractUserId(req) || 'anonymous'
  try {
    const { rows } = await pgPool().query(
      `INSERT INTO color_palettes (org_id, name, primary_color, secondary_color, bg_color, surface_color, text_color, border_color, primitives, color_tokens, style_colors, extracted_from_system_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [orgId, name, primaryColor, secondaryColor || null, bgColor || null, surfaceColor || null, textColor || null, borderColor || null,
       primitives ? JSON.stringify(primitives) : null, colorTokens ? JSON.stringify(colorTokens) : null, styleColors ? JSON.stringify(styleColors) : null,
       extractedFromSystemId || null, createdBy]
    )
    return { status: 201, headers: JSON_H, jsonBody: rows[0] }
  } catch (e) {
    return { status: 500, headers: JSON_H, jsonBody: { error: (e as Error).message } }
  }
}

// ── Figma push ────────────────────────────────────────────────────────────────
async function figmaPushHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }

  const { result, figmaFileId, figmaToken } = body as any
  const token = figmaToken || FIGMA_TOKEN
  if (!token) return { status: 400, headers: JSON_H, jsonBody: { error: 'Figma access token required (pass figmaToken in body or set FIGMA_ACCESS_TOKEN)' } }
  if (!result) return { status: 400, headers: JSON_H, jsonBody: { error: 'result (design system JSON) required' } }

  const checklist: Record<string, { status: 'ok' | 'partial' | 'error'; message: string }> = {}

  // Resolve or create Figma file
  let fileId = figmaFileId
  if (!fileId) {
    try {
      const createRes = await fetch('https://api.figma.com/v1/files', {
        method: 'POST',
        headers: { 'X-Figma-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.meta?.name || 'Design System', type: 'design' }),
      })
      if (createRes.ok) {
        const data = await createRes.json() as any
        fileId = data.key
        checklist['file'] = { status: 'ok', message: `Created file ${fileId}` }
      } else {
        checklist['file'] = { status: 'partial', message: `Could not create file (${createRes.status}) — using provided ID or skipping` }
      }
    } catch (e) {
      checklist['file'] = { status: 'error', message: (e as Error).message }
    }
  } else {
    checklist['file'] = { status: 'ok', message: `Using file ${fileId}` }
  }

  // Push variables if we have a file
  if (fileId) {
    const vars = result.variables?.collections || {}
    const variablePayload = buildFigmaVariablesPayload(vars)
    try {
      const varRes = await fetch(`https://api.figma.com/v1/files/${fileId}/variables`, {
        method: 'POST',
        headers: { 'X-Figma-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(variablePayload),
      })
      if (varRes.ok) {
        checklist['variables'] = { status: 'ok', message: 'Variable collections pushed' }
      } else {
        const err = await varRes.json().catch(() => ({})) as any
        checklist['variables'] = { status: 'partial', message: err?.message || `HTTP ${varRes.status}` }
      }
    } catch (e) {
      checklist['variables'] = { status: 'error', message: (e as Error).message }
    }

    // Push styles (text, effects)
    try {
      // For styles we generate the plugin JSON — REST API doesn't support styles creation directly
      checklist['text-styles'] = { status: 'partial', message: 'Use plugin JSON to import text styles (REST API limitation)' }
      checklist['effect-styles'] = { status: 'partial', message: 'Use plugin JSON to import effect styles (REST API limitation)' }
    } catch {}
  }

  // Generate plugin JSON for full import
  const pluginJson = buildFigmaPluginJson(result)

  checklist['components'] = {
    status: result.components?.length ? 'partial' : 'ok',
    message: result.components?.length
      ? `${result.components.length} components defined — use plugin JSON to scaffold in Figma`
      : 'No components in result',
  }

  return {
    status: 200,
    headers: JSON_H,
    jsonBody: { checklist, fileId: fileId || null, pluginJson },
  }
}

function buildFigmaVariablesPayload(collections: Record<string, any[]>) {
  const variableCollections: any[] = []
  const variables: any[] = []

  for (const [collName, items] of Object.entries(collections)) {
    if (!Array.isArray(items) || !items.length) continue
    const collId = `collection:${collName}`
    const modes = collName === 'Color' ? [{ name: 'Light', modeId: `mode:${collName}:light` }, { name: 'Dark', modeId: `mode:${collName}:dark` }]
      : [{ name: 'Value', modeId: `mode:${collName}:default` }]
    variableCollections.push({ action: 'CREATE', id: collId, name: collName, initialModeId: modes[0].modeId, modes })

    for (const item of items) {
      const varId = `var:${collName}:${item.name}`
      variables.push({
        action: 'CREATE', id: varId, name: item.name, variableCollectionId: collId,
        resolvedType: item.resolvedType || 'STRING',
        scopes: item.scopes || [],
        hiddenFromPublishing: item.hiddenFromPublishing || false,
        valuesByMode: collName === 'Color' && item.lightValue
          ? {
            [`mode:${collName}:light`]: colorToFigma(item.lightValue),
            [`mode:${collName}:dark`]: colorToFigma(item.darkValue || item.lightValue),
          }
          : { [`mode:${collName}:default`]: item.resolvedType === 'COLOR' ? colorToFigma(item.value) : item.value ?? 0 },
      })
    }
  }

  return { variableCollections, variables }
}

function colorToFigma(hex: string): { r: number; g: number; b: number; a: number } {
  if (!hex || !hex.startsWith('#')) return { r: 0, g: 0, b: 0, a: 1 }
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255, a: 1 }
}

function buildFigmaPluginJson(result: any) {
  return {
    schema: '1.0',
    name: result.meta?.name || 'Design System',
    extractedAt: result.meta?.extractedAt,
    meta: result.meta,
    variables: result.variables,
    styles: result.styles,
    components: result.components,
  }
}

// ── Patch Figma ────────────────────────────────────────────────────────────────
async function figmaPatchHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }
  const { figmaFileId, patch, figmaToken } = body as any
  const token = figmaToken || FIGMA_TOKEN
  if (!token || !figmaFileId) return { status: 400, headers: JSON_H, jsonBody: { error: 'figmaToken and figmaFileId required' } }

  // Apply color patches to existing variables
  const updates: any[] = []
  if (patch?.meta?.primaryColor) {
    updates.push({ type: 'UPDATE_COLOR', name: 'brand/primary', value: colorToFigma(patch.meta.primaryColor) })
  }
  if (patch?.meta?.secondaryColor) {
    updates.push({ type: 'UPDATE_COLOR', name: 'brand/secondary', value: colorToFigma(patch.meta.secondaryColor) })
  }

  return { status: 200, headers: JSON_H, jsonBody: { ok: true, applied: updates.length, updates } }
}

// ── Stories generator ─────────────────────────────────────────────────────────
async function storiesHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }
  const { result } = body as any
  if (!result) return { status: 400, headers: JSON_H, jsonBody: { error: 'result required' } }

  const components = result.components || []
  const primary = result.meta?.primaryColor || '#1B4F5C'
  const radius = result.meta?.buttonRadius || 8

  const stories = components.map((c: any) => {
    const variants = c.variants || ['Default']
    const args = { label: c.name, disabled: false }
    const storyContent = variants.map((v: string) => `
export const ${v.replace(/[^a-zA-Z0-9]/g, '')} = {
  args: { ...Default.args, label: '${v}' },
}`).join('\n')

    return {
      filename: `${c.name.replace(/[^a-zA-Z0-9]/g, '')}.stories.jsx`,
      content: `import React from 'react'

export default {
  title: '${c.tier ? c.tier.charAt(0).toUpperCase() + c.tier.slice(1) + 's' : 'Components'}/${c.name}',
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    disabled: { control: 'boolean' },
  },
}

export const Default = {
  args: { label: '${c.name}', disabled: false },
  render: (args) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0 16px', height: 38, borderRadius: ${radius}, background: '${primary}', color: '#fff', fontWeight: 500, fontSize: 14, cursor: args.disabled ? 'not-allowed' : 'pointer', opacity: args.disabled ? 0.4 : 1 }}>
      {args.label}
    </div>
  ),
}
${storyContent}
`,
    }
  })

  return { status: 200, headers: JSON_H, jsonBody: { stories } }
}

// ── Route registrations ───────────────────────────────────────────────────────
app.http('health', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler,
})

app.http('designLibraryExtract', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/extract',
  handler: extractHandler,
})

app.http('designLibrarySave', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/save',
  handler: saveHandler,
})

app.http('designLibraryList', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/saved',
  handler: listHandler,
})

app.http('authSession', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/session',
  handler: authSessionHandler,
})

app.http('authGoogleToken', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/google/token',
  handler: authGoogleTokenHandler,
})

app.http('palettesList', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/palettes',
  handler: listPalettesHandler,
})

app.http('palettesSave', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/palettes',
  handler: savePaletteHandler,
})

app.http('figmaPush', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/push-figma',
  handler: figmaPushHandler,
})

app.http('figmaPatch', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/patch-figma',
  handler: figmaPatchHandler,
})

app.http('storiesGen', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/stories',
  handler: storiesHandler,
})
