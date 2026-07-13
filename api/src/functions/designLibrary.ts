import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { TableClient, odata } from '@azure/data-tables'
import { Readable } from 'stream'

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
const SYSTEM_PROMPT = `You are a design system extraction expert. Given screenshots, URLs, and descriptions of an app, extract a COMPLETE Figma design library specification. Every value must use Figma Plugin API naming exactly so the output JSON can be consumed by a Figma plugin without modification.

Output a single JSON object matching this schema. Populate every section as thoroughly as possible.

{
  "meta": {
    "name": string,
    "primaryColor": string (hex),
    "bgColor": string (hex),
    "textColor": string (hex),
    "borderColor": string (hex),
    "buttonRadius": number,
    "cardRadius": number,
    "sidebarWidth": number,
    "fontFamily": string,
    "extractedAt": string (ISO)
  },
  "variables": {
    "collections": {
      "Primitives": [
        {
          "name": string (slash-separated path, e.g. "blue/500", "gray/100", "white/1000"),
          "value": string (hex for colors, number as string for floats),
          "resolvedType": "COLOR"|"FLOAT"|"STRING"|"BOOLEAN",
          "scopes": [] (empty array — primitives are always hidden from pickers)
        }
      ],
      "Color": [
        {
          "name": string (e.g. "color/bg/default", "color/text/brand", "color/border/default"),
          "lightValue": string (hex or alias path like "Primitives/blue/500"),
          "darkValue": string,
          "resolvedType": "COLOR",
          "scopes": ["FRAME_FILL"|"SHAPE_FILL"|"TEXT_FILL"|"STROKE_COLOR"|"EFFECT_COLOR"] (array, pick applicable ones),
          "cssVar": string (e.g. "var(--color-bg-default)")
        }
      ],
      "Spacing": [
        {
          "name": string (e.g. "spacing/xs", "spacing/sm", "radius/md", "border-width/default", "opacity/60", "z-index/modal", "icon-size/md"),
          "value": number,
          "resolvedType": "FLOAT",
          "scopes": ["GAP"|"CORNER_RADIUS"|"WIDTH_HEIGHT"|"STROKE_FLOAT"|"OPACITY"|"EFFECT_FLOAT"] (single most appropriate scope),
          "cssVar": string (e.g. "var(--spacing-sm)")
        }
      ],
      "Typography": [
        {
          "name": string (e.g. "font/family/sans", "font/family/mono", "font/weight/medium", "font/size/md"),
          "value": string|number,
          "resolvedType": "STRING"|"FLOAT",
          "scopes": ["FONT_FAMILY"|"FONT_STYLE"|"FONT_SIZE"|"LINE_HEIGHT"|"LETTER_SPACING"|"FONT_WEIGHT"],
          "cssVar": string
        }
      ],
      "Motion": [
        {
          "name": string (e.g. "motion/duration/fast", "motion/duration/normal", "motion/easing/ease-out"),
          "value": string|number (ms as number for durations, string for easing names),
          "resolvedType": "FLOAT"|"STRING",
          "cssVar": string (e.g. "var(--motion-duration-fast)")
        }
      ],
      "Component Tokens": [
        {
          "name": string (e.g. "button/bg/primary", "input/border/default", "card/radius"),
          "value": string (alias to Color or Spacing collection, e.g. "Color/color/bg/brand"),
          "component": string,
          "property": string,
          "cssVar": string
        }
      ]
    }
  },
  "styles": {
    "text": [
      {
        "name": string (Figma slash-group path, e.g. "Display/Hero", "Heading/H1", "Body/Medium", "Label/Small", "Code/Base", "Overline", "Caption"),
        "fontFamily": string (e.g. "Inter"),
        "fontStyle": string (EXACT Figma fontName.style string: "Regular"|"Medium"|"Semi Bold"|"Bold"|"Italic"|"Bold Italic"),
        "fontSize": number,
        "fontWeight": number,
        "lineHeight": { "value": number, "unit": "PIXELS"|"PERCENT"|"AUTO" },
        "letterSpacing": { "value": number, "unit": "PIXELS"|"PERCENT" },
        "usage": string
      }
    ],
    "color": [
      { "name": string, "color": string (hex), "usage": string }
    ],
    "effects": [
      {
        "name": string (e.g. "Shadow/Subtle", "Shadow/Medium", "Shadow/Strong", "Shadow/XL", "Inner/SM", "Blur/Background", "Elevation/1"),
        "type": "DROP_SHADOW"|"INNER_SHADOW"|"LAYER_BLUR"|"BACKGROUND_BLUR",
        "color": string (rgba, e.g. "rgba(0,0,0,0.05)"),
        "offsetX": number,
        "offsetY": number,
        "blur": number,
        "spread": number,
        "css": string (full CSS box-shadow or filter value)
      }
    ],
    "grids": [
      {
        "name": string (e.g. "Desktop 12-col", "Tablet 8-col", "Mobile 4-col", "Baseline/8px", "Micro/4px"),
        "pattern": "COLUMNS"|"ROWS"|"GRID",
        "breakpoint": number (px),
        "count": number (number of columns/rows),
        "gutter": number (px),
        "margin": number (px),
        "sectionSize": number (px, for ROWS/GRID patterns — the row height or cell size)
      }
    ]
  },
  "components": [
    {
      "name": string,
      "category": "Iconography"|"Atoms"|"Actions"|"Form Controls"|"Navigation"|"Feedback"|"Overlays"|"Data Display"|"Media"|"Layout"|"Patterns",
      "tier": "atom"|"molecule"|"organism"|"pattern",
      "description": string,
      "variants": string[] (style variant labels, e.g. ["Primary","Secondary","Ghost","Danger"]),
      "states": string[] (e.g. ["Default","Hover","Focused","Pressed","Disabled","Loading"]),
      "sizes": string[] (e.g. ["XS","S","M","L","XL"]),
      "variantProperties": { [axisName: string]: string[] },
      "componentProperties": {
        [propName: string]: { "type": "TEXT"|"BOOLEAN"|"INSTANCE_SWAP", "default": string }
      },
      "tokenBindings": string[] (list of token names this component uses, e.g. ["color/bg/brand","spacing/md","radius/md"]),
      "styleBindings": string[] (list of style names, e.g. ["Shadow/Subtle","Body/Medium"])
    }
  ],
  "patterns": [
    {
      "name": string (e.g. "Login Form", "Dashboard Layout", "Data Table with Filters", "Empty State Page"),
      "description": string,
      "components": string[] (component names used in this pattern)
    }
  ]
}

EXTRACTION RULES:

PRIMITIVES — extract full palette:
Every color stop visible or inferable: blue/100 through blue/900, gray/100 through gray/900, white/1000, black/1000, plus brand/accent/semantic palette stops. All scopes must be [] (empty).

SPACING COLLECTION — always include all of these, using standard values if not visible:
spacing/xs=4, spacing/sm=8, spacing/md=16, spacing/lg=24, spacing/xl=32, spacing/2xl=48, spacing/3xl=64 (scope: GAP)
radius/none=0, radius/xs=2, radius/sm=4, radius/md=8, radius/lg=16, radius/xl=24, radius/full=9999 (scope: CORNER_RADIUS)
border-width/thin=1, border-width/default=2, border-width/thick=4 (scope: STROKE_FLOAT)
opacity/0=0, opacity/10=10, opacity/20=20, opacity/40=40, opacity/60=60, opacity/80=80, opacity/100=100 (scope: OPACITY)
icon-size/xs=12, icon-size/sm=16, icon-size/md=20, icon-size/lg=24, icon-size/xl=32 (scope: WIDTH_HEIGHT)
z-index/base=0, z-index/dropdown=100, z-index/sticky=200, z-index/overlay=300, z-index/modal=400, z-index/toast=500 (scope: WIDTH_HEIGHT)

MOTION COLLECTION — always include:
motion/duration/instant=0, motion/duration/fast=100, motion/duration/normal=200, motion/duration/slow=400, motion/duration/slower=600 (resolvedType: FLOAT)
motion/easing/linear="linear", motion/easing/ease-in="ease-in", motion/easing/ease-out="ease-out", motion/easing/ease-in-out="ease-in-out", motion/easing/spring="cubic-bezier(0.34,1.56,0.64,1)" (resolvedType: STRING)

TEXT STYLES — always include all of these (infer size/weight from context, use Inter as default font):
Display/Hero: fontStyle="Bold" fontSize=72 lineHeight={value:80,unit:"PIXELS"} letterSpacing={value:-1.5,unit:"PIXELS"}
Heading/H1: fontStyle="Bold" fontSize=48 lineHeight={value:56,unit:"PIXELS"} letterSpacing={value:-1,unit:"PIXELS"}
Heading/H2: fontStyle="Bold" fontSize=40 lineHeight={value:48,unit:"PIXELS"} letterSpacing={value:-0.5,unit:"PIXELS"}
Heading/H3: fontStyle="Semi Bold" fontSize=32 lineHeight={value:40,unit:"PIXELS"} letterSpacing={value:0,unit:"PIXELS"}
Heading/H4: fontStyle="Semi Bold" fontSize=24 lineHeight={value:32,unit:"PIXELS"} letterSpacing={value:0,unit:"PIXELS"}
Heading/H5: fontStyle="Medium" fontSize=20 lineHeight={value:28,unit:"PIXELS"} letterSpacing={value:0,unit:"PIXELS"}
Heading/H6: fontStyle="Medium" fontSize=16 lineHeight={value:24,unit:"PIXELS"} letterSpacing={value:0,unit:"PIXELS"}
Body/Large: fontStyle="Regular" fontSize=18 lineHeight={value:28,unit:"PIXELS"}
Body/Medium: fontStyle="Regular" fontSize=16 lineHeight={value:24,unit:"PIXELS"}
Body/Small: fontStyle="Regular" fontSize=14 lineHeight={value:20,unit:"PIXELS"}
Body/XSmall: fontStyle="Regular" fontSize=12 lineHeight={value:16,unit:"PIXELS"}
Label/Large: fontStyle="Medium" fontSize=14 lineHeight={value:20,unit:"PIXELS"} letterSpacing={value:0.1,unit:"PIXELS"}
Label/Medium: fontStyle="Medium" fontSize=12 lineHeight={value:16,unit:"PIXELS"} letterSpacing={value:0.5,unit:"PIXELS"}
Label/Small: fontStyle="Medium" fontSize=11 lineHeight={value:16,unit:"PIXELS"} letterSpacing={value:0.5,unit:"PIXELS"}
Code/Base: fontFamily="Roboto Mono" fontStyle="Regular" fontSize=14 lineHeight={value:20,unit:"PIXELS"}
Code/Small: fontFamily="Roboto Mono" fontStyle="Regular" fontSize=12 lineHeight={value:16,unit:"PIXELS"}
Overline: fontStyle="Medium" fontSize=11 lineHeight={value:16,unit:"PIXELS"} letterSpacing={value:1.5,unit:"PIXELS"}
Caption: fontStyle="Regular" fontSize=12 lineHeight={value:16,unit:"PIXELS"}
Override any of the above with observed values from the screenshots.

EFFECT STYLES — always include (use standard CSS values if not visible):
Shadow/Subtle: type=DROP_SHADOW offsetY=1 blur=2 spread=0 color="rgba(0,0,0,0.05)"
Shadow/Small: type=DROP_SHADOW offsetY=2 blur=4 spread=0 color="rgba(0,0,0,0.08)"
Shadow/Medium: type=DROP_SHADOW offsetY=4 blur=8 spread=-1 color="rgba(0,0,0,0.10)"
Shadow/Strong: type=DROP_SHADOW offsetY=8 blur=16 spread=-2 color="rgba(0,0,0,0.12)"
Shadow/XL: type=DROP_SHADOW offsetY=16 blur=32 spread=-4 color="rgba(0,0,0,0.14)" (modals/dialogs)
Shadow/2XL: type=DROP_SHADOW offsetY=24 blur=48 spread=-6 color="rgba(0,0,0,0.18)" (drawers)
Inner/SM: type=INNER_SHADOW offsetY=1 blur=2 spread=0 color="rgba(0,0,0,0.06)"
Inner/MD: type=INNER_SHADOW offsetY=2 blur=4 spread=0 color="rgba(0,0,0,0.08)"
Blur/Background: type=BACKGROUND_BLUR blur=16 (frosted glass overlays)
Blur/Layer: type=LAYER_BLUR blur=8 (content blur)
Add Elevation/1 through Elevation/3 if M3-style naming is appropriate for this design.

GRID STYLES — always include all breakpoints:
Desktop 12-col: pattern=COLUMNS breakpoint=1440 count=12 gutter=24 margin=80
Laptop 12-col: pattern=COLUMNS breakpoint=1280 count=12 gutter=24 margin=64
Tablet 12-col: pattern=COLUMNS breakpoint=1024 count=12 gutter=20 margin=40
Tablet 8-col: pattern=COLUMNS breakpoint=768 count=8 gutter=20 margin=24
Mobile 4-col: pattern=COLUMNS breakpoint=375 count=4 gutter=16 margin=16
Baseline/8px: pattern=ROWS sectionSize=8
Micro/4px: pattern=ROWS sectionSize=4

COMPONENTS — extract ALL of the following (plus any additional ones visible):
Iconography: Icon, Pictogram
Atoms: Color Swatch, Typography Specimen, Avatar, Badge, Tag/Chip, Divider, Spinner, Skeleton
Actions: Button, Icon Button, Button Group, Segmented Control, Split Button, FAB
Form Controls: Text Input, Textarea, Password Input, Search Input, Number Stepper, Select, Multi-Select, Combobox, Checkbox, Radio Button, Radio Group, Toggle/Switch, Slider, Range Slider, Date Picker, Time Picker, Date Range Picker, File Upload, Color Picker, Rating, OTP/PIN Input, Form Field
Navigation: Top Navigation/App Bar, Side Navigation, Bottom Navigation, Breadcrumb, Tabs, Stepper/Wizard, Pagination, Page Header, Section Header, Dropdown Menu, Menu Item, Context Menu, Command Palette
Feedback: Alert/Banner, Toast/Snackbar, Inline Message
Overlays: Modal/Dialog, Drawer/Sheet, Confirmation Dialog, Tooltip, Popover
Data Display: Card, List Item, Accordion, Table, Data Grid, Timeline, Tree View, Stat/KPI Card, Chart Placeholder, Chart Legend, Chart Tooltip
Media: Image, Video/Media Placeholder, Code Block, Carousel, Map Placeholder, Rich Text
Layout: Container, Section, Grid, Row, Column, Responsive Frame
Patterns: Login/Auth Screen, Dashboard Layout, Data Table + Filters, Form with Validation, Empty State Page, Error Page

For each component: include all applicable variant axes, states, sizes, component properties (TEXT/BOOLEAN/INSTANCE_SWAP), and token/style bindings.

Respond ONLY with the JSON object. No markdown fences, no explanation.`

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

  // Use Node.js Readable.from(asyncGenerator) — required for Azure Functions v4
  // streaming. The Web ReadableStream API is buffered by the runtime; only a
  // Node.js Readable is flushed chunk-by-chunk to the client.
  async function* generate() {
    // Pad every line to ≥4 KB so intermediate proxies flush immediately.
    const line = (obj: object) => {
      const json = JSON.stringify(obj)
      return json + ' '.repeat(Math.max(0, 4096 - json.length - 1)) + '\n'
    }

    const CATEGORIES = ['primitives', 'color-tokens', 'spacing-tokens', 'motion-tokens', 'typography', 'text-styles', 'effect-styles', 'grid-styles', 'components', 'patterns', 'finalizing']
    const CAT_MARKERS: Record<string, string[]> = {
      'primitives':     ['"variables"', '"Primitives"', '"primitives"'],
      'color-tokens':   ['"Color"', '"color-tokens"', '"colorTokens"'],
      'spacing-tokens': ['"Spacing"', '"spacing"', '"spacingTokens"'],
      'motion-tokens':  ['"Motion"', '"motion"', '"motionTokens"'],
      'typography':     ['"Typography"', '"typography"', '"typographyPrimitives"'],
      'text-styles':    ['"textStyles"', '"text-styles"'],
      'effect-styles':  ['"effectStyles"', '"effect-styles"'],
      'grid-styles':    ['"gridStyles"', '"grid-styles"'],
      'components':     ['"components"'],
      'patterns':       ['"patterns"'],
      'finalizing':     ['"meta"'],
    }

    const completed = new Set<string>()
    let activeCat = 'primitives'
    // Buffer yielded lines so the heartbeat interval can push into the generator
    const queue: string[] = []
    let resolve: (() => void) | null = null
    const push = (obj: object) => { queue.push(line(obj)); if (resolve) resolve() }

    const keepAlive = setInterval(() => push({ type: 'heartbeat', ts: Date.now() }), 5000)
    const stop = () => clearInterval(keepAlive)

    function advanceProgress(buf: string) {
      for (const [cat, markers] of Object.entries(CAT_MARKERS)) {
        if (completed.has(cat)) continue
        if (markers.some(m => buf.includes(m))) {
          if (activeCat !== cat && !completed.has(activeCat)) {
            completed.add(activeCat)
            push({ type: 'progress', category: activeCat, message: `${activeCat} extracted`, done: true })
          }
          activeCat = cat
          push({ type: 'progress', category: cat, message: `Extracting ${cat}…` })
          break
        }
      }
    }

    // Drain the queue, waiting for new items if empty
    async function* drain() {
      while (true) {
        while (queue.length) yield queue.shift()!
        await new Promise<void>(r => { resolve = r })
        resolve = null
      }
    }

    // Kick off the Anthropic call in parallel with the drain loop
    let done = false
    let error: string | null = null
    let finalResult: any = null

    push({ type: 'progress', category: 'primitives', message: 'Connecting to Claude…' })
    push({ type: 'heartbeat', ts: Date.now() })

    const work = (async () => {
      try {
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
          error = err?.error?.message || `Anthropic API ${anthropicRes.status}`
          return
        }

        push({ type: 'progress', category: 'primitives', message: 'Claude is analysing your design…' })

        const reader = anthropicRes.body!.getReader()
        const dec = new TextDecoder()
        let sseBuf = ''
        let jsonBuf = ''
        let tokenCount = 0

        while (true) {
          const { done: d, value } = await reader.read()
          if (d) break
          sseBuf += dec.decode(value, { stream: true })
          const lines = sseBuf.split('\n')
          sseBuf = lines.pop()!
          for (const l of lines) {
            if (!l.startsWith('data: ')) continue
            const data = l.slice(6)
            if (data === '[DONE]') continue
            try {
              const evt = JSON.parse(data)
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                jsonBuf += evt.delta.text
                tokenCount++
                advanceProgress(jsonBuf)
              }
            } catch {}
          }
        }

        for (const cat of CATEGORIES) {
          if (!completed.has(cat)) push({ type: 'progress', category: cat, message: `${cat} extracted`, done: true })
        }
        push({ type: 'progress', category: 'finalizing', message: 'Parsing result…' })

        let result: any = null
        try {
          result = JSON.parse(jsonBuf.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim())
        } catch {
          const m = jsonBuf.match(/\{[\s\S]*\}/)
          if (m) try { result = JSON.parse(m[0]) } catch {}
        }

        if (!result) { error = 'JSON parse failed — Claude response was not valid JSON'; return }
        if (!result.meta) result.meta = {}
        result.meta.name = result.meta.name || name || 'Design System'
        result.meta.extractedAt = new Date().toISOString()
        result.meta.tokenCount = tokenCount
        finalResult = result
      } catch (e) {
        error = (e as Error).message
      } finally {
        done = true
        stop()
        if (resolve) resolve()
      }
    })()

    for await (const chunk of drain()) {
      yield chunk
      if (done) break
    }
    await work

    if (error) yield line({ type: 'progress', category: 'error', message: error, done: true })
    else if (finalResult) yield line({ type: 'result', data: finalResult })
  }

  const nodeStream = Readable.from(generate(), { objectMode: false })
  return { status: 200, headers: STREAM_H, body: nodeStream as any }
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
  stream: true,
} as any)

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
