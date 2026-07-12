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
const SYSTEM_PROMPT = `You are a design system extraction expert. Given screenshots, URLs, and descriptions of an app, you extract a complete Figma design library specification.

Your output MUST be a JSON object matching EXACTLY this schema:
{
  "meta": {
    "name": string,
    "primaryColor": string (hex),
    "bgColor": string (hex),
    "textColor": string (hex),
    "borderColor": string (hex),
    "buttonRadius": number (px),
    "cardRadius": number (px),
    "sidebarWidth": number (px),
    "fontFamily": string,
    "extractedAt": string (ISO)
  },
  "variables": {
    "collections": {
      "Primitives": [
        { "name": string, "value": string, "type": "color"|"number"|"string", "resolvedType": "COLOR"|"FLOAT"|"STRING" }
      ],
      "Tokens": [
        { "name": string, "lightValue": string, "darkValue": string, "type": string, "resolvedType": string }
      ],
      "Component Tokens": [
        { "name": string, "value": string, "component": string, "property": string }
      ]
    }
  },
  "styles": {
    "text": [
      { "name": string, "fontFamily": string, "fontSize": number, "fontWeight": number, "lineHeight": number, "letterSpacing": number, "usage": string }
    ],
    "color": [
      { "name": string, "color": string, "usage": string }
    ],
    "effects": [
      { "name": string, "type": "drop-shadow"|"inner-shadow"|"blur"|"background-blur", "value": string, "css": string }
    ],
    "grids": [
      { "name": string, "type": "columns"|"rows"|"grid", "count": number, "gutter": number, "margin": number }
    ]
  },
  "components": [
    {
      "name": string,
      "category": string,
      "variants": string[],
      "variantProperties": { [key: string]: string[] },
      "componentProperties": { [key: string]: { type: "TEXT"|"BOOLEAN"|"INSTANCE_SWAP", default: string } },
      "tokenBindings": string[],
      "styleBindings": string[]
    }
  ]
}

Extract EVERY component visible. Minimum expected components: Button, Input, Card, Badge, Modal/Dialog, Navbar/Header, Sidebar/Nav, Table/List, Tabs, Dropdown/Select, Avatar, Alert/Banner, Tooltip, Chip/Pill, Icon, Spinner/Loader.

For colors: extract exact hex values when visible, otherwise infer from context.
For typography: extract every distinct text style visible. Always include Display, H1, H2, H3, Body, Body SM, Caption, Label, Overline, Code.

Respond ONLY with the JSON object. No markdown, no explanation.`

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

      const CATEGORIES = ['colors', 'typography', 'spacing', 'tokens', 'components', 'effects', 'grids', 'finalizing']
      let catIdx = 0

      try {
        emit({ type: 'progress', category: 'colors', message: 'Sending to Claude…' })

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
                if (jsonBuf.length % 500 < 10 && catIdx < CATEGORIES.length) {
                  emit({ type: 'progress', category: CATEGORIES[catIdx], message: `Extracting ${CATEGORIES[catIdx]}…` })
                  if (catIdx < CATEGORIES.length - 1) catIdx++
                }
              }
            } catch { /* partial */ }
          }
        }

        for (const cat of CATEGORIES) emit({ type: 'progress', category: cat, message: `${cat} complete`, done: true })

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
