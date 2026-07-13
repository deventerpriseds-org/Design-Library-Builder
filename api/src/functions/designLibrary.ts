import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { TableClient, odata } from '@azure/data-tables'

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING!
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const TABLE = 'DesignLibraries'

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
