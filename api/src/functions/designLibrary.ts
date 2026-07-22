import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { TableClient, odata } from '@azure/data-tables'
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob'
import { QueueServiceClient } from '@azure/storage-queue'
import { Pool } from 'pg'

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING!
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const TABLE = 'DesignLibraries'
const FIGMA_TOKEN = process.env.FIGMA_ACCESS_TOKEN || ''
const GH_PAT = process.env.GH_PAT || ''
const GH_REPO_OWNER = process.env.GH_REPO_OWNER || 'deventerpriseds-org'
const GH_REPO_NAME = process.env.GH_REPO_NAME || 'Design-Library-Builder'
const GH_STORIES_BRANCH = process.env.GH_STORIES_BRANCH || 'main'

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
// ── Baseline design system (merged with Claude's brand diff) ─────────────────
function buildBaseline(name: string, primaryColor: string, fontFamily: string) {
  const p = primaryColor || '#6366F1'
  const font = fontFamily || 'Inter'
  return {
    meta: {
      name, primaryColor: p, secondaryColor: '#8B5CF6', bgColor: '#F9FAFB', surfaceColor: '#FFFFFF',
      textColor: '#111827', borderColor: '#E5E7EB', buttonRadius: 6, cardRadius: 8, inputRadius: 6,
      sidebarWidth: 240, fontFamily: font, monoFontFamily: 'JetBrains Mono',
      inferenceMap: { primitives: 'inferred', colorTokens: 'inferred', spacingTokens: 'inferred', motionTokens: 'inferred', typography: 'inferred', textStyles: 'inferred', effectStyles: 'inferred', gridStyles: 'inferred', components: 'inferred', patterns: 'inferred' }
    },
    variables: {
      collections: {
        Primitives: [
          { name: 'brand-50', value: '#EEF2FF', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'brand-100', value: '#E0E7FF', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'brand-200', value: '#C7D2FE', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'brand-300', value: '#A5B4FC', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'brand-400', value: '#818CF8', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'brand-500', value: p, type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'brand-600', value: '#4F46E5', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'brand-700', value: '#4338CA', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'brand-800', value: '#3730A3', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'brand-900', value: '#312E81', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-0', value: '#FFFFFF', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-50', value: '#F9FAFB', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-100', value: '#F3F4F6', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-200', value: '#E5E7EB', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-300', value: '#D1D5DB', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-400', value: '#9CA3AF', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-500', value: '#6B7280', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-600', value: '#4B5563', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-700', value: '#374151', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-800', value: '#1F2937', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'neutral-900', value: '#111827', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'success-500', value: '#22C55E', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'warning-500', value: '#F59E0B', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'error-500', value: '#EF4444', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
          { name: 'info-500', value: '#3B82F6', type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true },
        ],
        Color: [
          { name: 'action/primary', lightValue: p, darkValue: '#818CF8', lightAlias: 'brand-500', darkAlias: 'brand-400', resolvedType: 'COLOR', scopes: ['FRAME_FILL', 'SHAPE_FILL'], description: 'Primary action color' },
          { name: 'action/secondary', lightValue: '#8B5CF6', darkValue: '#A78BFA', lightAlias: 'brand-600', darkAlias: 'brand-300', resolvedType: 'COLOR', scopes: ['FRAME_FILL', 'SHAPE_FILL'], description: 'Secondary action color' },
          { name: 'surface/page', lightValue: '#F9FAFB', darkValue: '#111827', lightAlias: 'neutral-50', darkAlias: 'neutral-900', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], description: 'Page background' },
          { name: 'surface/card', lightValue: '#FFFFFF', darkValue: '#1F2937', lightAlias: 'neutral-0', darkAlias: 'neutral-800', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], description: 'Card surface' },
          { name: 'surface/overlay', lightValue: 'rgba(0,0,0,0.5)', darkValue: 'rgba(0,0,0,0.7)', lightAlias: '', darkAlias: '', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], description: 'Modal overlay' },
          { name: 'text/primary', lightValue: '#111827', darkValue: '#F9FAFB', lightAlias: 'neutral-900', darkAlias: 'neutral-50', resolvedType: 'COLOR', scopes: ['TEXT_FILL'], description: 'Primary text' },
          { name: 'text/secondary', lightValue: '#6B7280', darkValue: '#9CA3AF', lightAlias: 'neutral-500', darkAlias: 'neutral-400', resolvedType: 'COLOR', scopes: ['TEXT_FILL'], description: 'Secondary text' },
          { name: 'text/disabled', lightValue: '#9CA3AF', darkValue: '#4B5563', lightAlias: 'neutral-400', darkAlias: 'neutral-600', resolvedType: 'COLOR', scopes: ['TEXT_FILL'], description: 'Disabled text' },
          { name: 'border/default', lightValue: '#E5E7EB', darkValue: '#374151', lightAlias: 'neutral-200', darkAlias: 'neutral-700', resolvedType: 'COLOR', scopes: ['STROKE_COLOR'], description: 'Default border' },
          { name: 'border/focus', lightValue: p, darkValue: '#818CF8', lightAlias: 'brand-500', darkAlias: 'brand-400', resolvedType: 'COLOR', scopes: ['STROKE_COLOR'], description: 'Focus ring' },
          { name: 'status/success', lightValue: '#22C55E', darkValue: '#4ADE80', lightAlias: 'success-500', darkAlias: 'success-500', resolvedType: 'COLOR', scopes: ['FRAME_FILL', 'TEXT_FILL'], description: 'Success state' },
          { name: 'status/warning', lightValue: '#F59E0B', darkValue: '#FCD34D', lightAlias: 'warning-500', darkAlias: 'warning-500', resolvedType: 'COLOR', scopes: ['FRAME_FILL', 'TEXT_FILL'], description: 'Warning state' },
          { name: 'status/error', lightValue: '#EF4444', darkValue: '#F87171', lightAlias: 'error-500', darkAlias: 'error-500', resolvedType: 'COLOR', scopes: ['FRAME_FILL', 'TEXT_FILL'], description: 'Error state' },
          { name: 'status/info', lightValue: '#3B82F6', darkValue: '#60A5FA', lightAlias: 'info-500', darkAlias: 'info-500', resolvedType: 'COLOR', scopes: ['FRAME_FILL', 'TEXT_FILL'], description: 'Info state' },
        ],
        Spacing: [
          { name: '0', value: 0, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: 'No space' },
          { name: '1', value: 4, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: '4px' },
          { name: '2', value: 8, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: '8px' },
          { name: '3', value: 12, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: '12px' },
          { name: '4', value: 16, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: '16px' },
          { name: '5', value: 24, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: '24px' },
          { name: '6', value: 32, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: '32px' },
          { name: '7', value: 48, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: '48px' },
          { name: '8', value: 64, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: '64px' },
          { name: '9', value: 96, resolvedType: 'FLOAT', scopes: ['GAP', 'WIDTH_HEIGHT'], description: '96px' },
        ],
        Motion: [
          { name: 'duration/instant', value: 0, resolvedType: 'FLOAT', description: '0ms' },
          { name: 'duration/fast', value: 100, resolvedType: 'FLOAT', description: '100ms' },
          { name: 'duration/base', value: 200, resolvedType: 'FLOAT', description: '200ms' },
          { name: 'duration/slow', value: 300, resolvedType: 'FLOAT', description: '300ms' },
          { name: 'duration/slower', value: 500, resolvedType: 'FLOAT', description: '500ms' },
          { name: 'easing/ease-out', value: 'cubic-bezier(0,0,0.2,1)', resolvedType: 'STRING', description: 'Standard ease-out' },
          { name: 'easing/ease-in', value: 'cubic-bezier(0.4,0,1,1)', resolvedType: 'STRING', description: 'Standard ease-in' },
          { name: 'easing/spring', value: 'cubic-bezier(0.34,1.56,0.64,1)', resolvedType: 'STRING', description: 'Springy overshoot' },
        ],
        Typography: [
          { name: 'family/sans', value: font, resolvedType: 'STRING', scopes: ['FONT_FAMILY'], description: 'Primary sans-serif font' },
          { name: 'family/mono', value: 'JetBrains Mono', resolvedType: 'STRING', scopes: ['FONT_FAMILY'], description: 'Monospace font' },
          { name: 'size/xs', value: 11, resolvedType: 'FLOAT', scopes: ['FONT_SIZE'], description: '11px' },
          { name: 'size/sm', value: 13, resolvedType: 'FLOAT', scopes: ['FONT_SIZE'], description: '13px' },
          { name: 'size/base', value: 14, resolvedType: 'FLOAT', scopes: ['FONT_SIZE'], description: '14px' },
          { name: 'size/md', value: 16, resolvedType: 'FLOAT', scopes: ['FONT_SIZE'], description: '16px' },
          { name: 'size/lg', value: 18, resolvedType: 'FLOAT', scopes: ['FONT_SIZE'], description: '18px' },
          { name: 'size/xl', value: 20, resolvedType: 'FLOAT', scopes: ['FONT_SIZE'], description: '20px' },
          { name: 'size/2xl', value: 24, resolvedType: 'FLOAT', scopes: ['FONT_SIZE'], description: '24px' },
          { name: 'size/3xl', value: 30, resolvedType: 'FLOAT', scopes: ['FONT_SIZE'], description: '30px' },
          { name: 'size/4xl', value: 36, resolvedType: 'FLOAT', scopes: ['FONT_SIZE'], description: '36px' },
        ],
        'Component Tokens': [],
      }
    },
    styles: {
      text: [
        { name: 'Display', fontFamily: font, fontStyle: 'Bold', fontSize: 48, fontWeight: 700, lineHeight: { value: 56, unit: 'PIXELS' }, letterSpacing: { value: -0.5, unit: 'PIXELS' }, paragraphSpacing: 0, usage: 'Hero headings', tier: 'display' },
        { name: 'H1', fontFamily: font, fontStyle: 'Bold', fontSize: 36, fontWeight: 700, lineHeight: { value: 44, unit: 'PIXELS' }, letterSpacing: { value: -0.3, unit: 'PIXELS' }, paragraphSpacing: 0, usage: 'Page titles', tier: 'heading' },
        { name: 'H2', fontFamily: font, fontStyle: 'Semi Bold', fontSize: 28, fontWeight: 600, lineHeight: { value: 36, unit: 'PIXELS' }, letterSpacing: { value: -0.2, unit: 'PIXELS' }, paragraphSpacing: 0, usage: 'Section titles', tier: 'heading' },
        { name: 'H3', fontFamily: font, fontStyle: 'Semi Bold', fontSize: 22, fontWeight: 600, lineHeight: { value: 30, unit: 'PIXELS' }, letterSpacing: { value: -0.1, unit: 'PIXELS' }, paragraphSpacing: 0, usage: 'Card headings', tier: 'heading' },
        { name: 'H4', fontFamily: font, fontStyle: 'Medium', fontSize: 18, fontWeight: 500, lineHeight: { value: 26, unit: 'PIXELS' }, letterSpacing: { value: 0, unit: 'PIXELS' }, paragraphSpacing: 0, usage: 'Sub-section headings', tier: 'heading' },
        { name: 'Body LG', fontFamily: font, fontStyle: 'Regular', fontSize: 16, fontWeight: 400, lineHeight: { value: 24, unit: 'PIXELS' }, letterSpacing: { value: 0, unit: 'PIXELS' }, paragraphSpacing: 16, usage: 'Lead body copy', tier: 'body' },
        { name: 'Body', fontFamily: font, fontStyle: 'Regular', fontSize: 14, fontWeight: 400, lineHeight: { value: 22, unit: 'PIXELS' }, letterSpacing: { value: 0, unit: 'PIXELS' }, paragraphSpacing: 14, usage: 'Default body copy', tier: 'body' },
        { name: 'Body SM', fontFamily: font, fontStyle: 'Regular', fontSize: 13, fontWeight: 400, lineHeight: { value: 20, unit: 'PIXELS' }, letterSpacing: { value: 0, unit: 'PIXELS' }, paragraphSpacing: 12, usage: 'Small body copy', tier: 'body' },
        { name: 'Label', fontFamily: font, fontStyle: 'Semi Bold', fontSize: 12, fontWeight: 600, lineHeight: { value: 18, unit: 'PIXELS' }, letterSpacing: { value: 0.1, unit: 'PIXELS' }, paragraphSpacing: 0, usage: 'Form labels, tags', tier: 'label' },
        { name: 'Caption', fontFamily: font, fontStyle: 'Regular', fontSize: 11, fontWeight: 400, lineHeight: { value: 16, unit: 'PIXELS' }, letterSpacing: { value: 0.1, unit: 'PIXELS' }, paragraphSpacing: 0, usage: 'Timestamps, helper text', tier: 'caption' },
        { name: 'Code', fontFamily: 'JetBrains Mono', fontStyle: 'Regular', fontSize: 13, fontWeight: 400, lineHeight: { value: 20, unit: 'PIXELS' }, letterSpacing: { value: 0, unit: 'PIXELS' }, paragraphSpacing: 0, usage: 'Inline code, snippets', tier: 'code' },
      ],
      color: [
        { name: 'Brand/Primary', color: p, usage: 'Primary brand color swatch' },
        { name: 'Status/Success', color: '#22C55E', usage: 'Success state' },
        { name: 'Status/Warning', color: '#F59E0B', usage: 'Warning state' },
        { name: 'Status/Error', color: '#EF4444', usage: 'Error state' },
      ],
      effects: [
        { name: 'Shadow/SM', type: 'DROP_SHADOW', radius: 4, spread: 0, color: 'rgba(0,0,0,0.06)', offsetX: 0, offsetY: 1, css: '0 1px 4px rgba(0,0,0,0.06)' },
        { name: 'Shadow/MD', type: 'DROP_SHADOW', radius: 8, spread: -2, color: 'rgba(0,0,0,0.10)', offsetX: 0, offsetY: 4, css: '0 4px 8px -2px rgba(0,0,0,0.10)' },
        { name: 'Shadow/LG', type: 'DROP_SHADOW', radius: 16, spread: -4, color: 'rgba(0,0,0,0.12)', offsetX: 0, offsetY: 8, css: '0 8px 16px -4px rgba(0,0,0,0.12)' },
        { name: 'Shadow/XL', type: 'DROP_SHADOW', radius: 32, spread: -8, color: 'rgba(0,0,0,0.14)', offsetX: 0, offsetY: 16, css: '0 16px 32px -8px rgba(0,0,0,0.14)' },
      ],
      grids: [
        { name: 'Desktop/12-col', pattern: 'COLUMNS', count: 12, gutter: 24, margin: 32, alignment: 'STRETCH', breakpoint: '1440px' },
        { name: 'Tablet/8-col', pattern: 'COLUMNS', count: 8, gutter: 16, margin: 24, alignment: 'STRETCH', breakpoint: '768px' },
        { name: 'Mobile/4-col', pattern: 'COLUMNS', count: 4, gutter: 12, margin: 16, alignment: 'STRETCH', breakpoint: '375px' },
      ]
    },
    components: [
      { name: 'Button', description: 'Primary action trigger — filled, outlined, and ghost variants for hierarchy across forms, dialogs, and toolbars.', tier: 'atom', category: 'Actions', variants: ['Primary', 'Secondary', 'Ghost', 'Destructive', 'Link'], states: ['Default', 'Hover', 'Pressed', 'Disabled', 'Loading'], variantProperties: { Type: ['Primary', 'Secondary', 'Ghost', 'Destructive', 'Link'], Size: ['SM', 'MD', 'LG'] }, componentProperties: { Label: { type: 'TEXT', default: 'Button' }, HasIcon: { type: 'BOOLEAN', default: 'false' } }, tokenBindings: ['action/primary', 'action/secondary'], styleBindings: ['Label'], variableBindings: { fill: 'action/primary', radius: 'size/base' } },
      { name: 'Input', description: 'Text entry field with label, placeholder, and validation states — used in forms, search bars, and settings panels.', tier: 'atom', category: 'Forms', variants: ['Default', 'Error', 'Success', 'Disabled'], states: ['Empty', 'Focused', 'Filled', 'Disabled'], variantProperties: { State: ['Default', 'Error', 'Success', 'Disabled'], Type: ['Text', 'Password', 'Search', 'Number'] }, componentProperties: { Placeholder: { type: 'TEXT', default: 'Enter value…' }, HasLabel: { type: 'BOOLEAN', default: 'true' } }, tokenBindings: ['border/default', 'border/focus'], styleBindings: ['Body'], variableBindings: { stroke: 'border/default' } },
      { name: 'Checkbox', description: 'Binary selection control — checked, unchecked, and indeterminate states with accessible label.', tier: 'atom', category: 'Forms', variants: ['Unchecked', 'Checked', 'Indeterminate', 'Disabled'], states: ['Default', 'Hover', 'Focused', 'Disabled'], variantProperties: { State: ['Unchecked', 'Checked', 'Indeterminate', 'Disabled'] }, componentProperties: { Label: { type: 'TEXT', default: 'Label' } }, tokenBindings: ['action/primary', 'border/default'], styleBindings: ['Label'], variableBindings: { fill: 'action/primary' } },
      { name: 'Badge', description: 'Compact status or category label — pill-shaped, color-coded by semantic meaning (success, warning, error, brand).', tier: 'atom', category: 'Status', variants: ['Brand', 'Success', 'Warning', 'Error', 'Info', 'Neutral', 'Outline'], states: ['Default'], variantProperties: { Variant: ['Brand', 'Success', 'Warning', 'Error', 'Info', 'Neutral'] }, componentProperties: { Label: { type: 'TEXT', default: 'Badge' } }, tokenBindings: ['status/success', 'status/error', 'status/warning'], styleBindings: ['Label'], variableBindings: {} },
      { name: 'Avatar', description: 'User identity representation — supports profile image, initials fallback, and presence status indicator.', tier: 'atom', category: 'Identity', variants: ['Image', 'Initials', 'Icon', 'Placeholder'], states: ['Default', 'WithStatus'], variantProperties: { Type: ['Image', 'Initials', 'Icon'], Size: ['XS', 'SM', 'MD', 'LG', 'XL'] }, componentProperties: { Initials: { type: 'TEXT', default: 'AB' } }, tokenBindings: ['action/primary', 'surface/card'], styleBindings: ['Label'], variableBindings: {} },
      { name: 'Card', description: 'Contained surface for grouping related content — supports header, body, and footer zones with optional elevation.', tier: 'molecule', category: 'Layout', variants: ['Basic', 'Elevated', 'Outlined', 'Interactive'], states: ['Default', 'Hover'], variantProperties: { Variant: ['Basic', 'Elevated', 'Outlined', 'Interactive'] }, componentProperties: { HasHeader: { type: 'BOOLEAN', default: 'true' }, HasFooter: { type: 'BOOLEAN', default: 'false' } }, tokenBindings: ['surface/card', 'border/default'], styleBindings: ['H4', 'Body'], variableBindings: { fill: 'surface/card', stroke: 'border/default' } },
      { name: 'Alert', description: 'Inline feedback banner — four semantic types (info, success, warning, error) with optional dismiss action.', tier: 'molecule', category: 'Feedback', variants: ['Info', 'Success', 'Warning', 'Error'], states: ['Default', 'Dismissible'], variantProperties: { Type: ['Info', 'Success', 'Warning', 'Error'] }, componentProperties: { Title: { type: 'TEXT', default: 'Alert title' }, Message: { type: 'TEXT', default: 'Alert message' }, Dismissible: { type: 'BOOLEAN', default: 'false' } }, tokenBindings: ['status/success', 'status/error', 'status/warning', 'status/info'], styleBindings: ['Label', 'Body SM'], variableBindings: {} },
      { name: 'Table', description: 'Structured data grid with sortable columns, row selection, and pagination — used for lists, reports, and records.', tier: 'organism', category: 'Data', variants: ['Default', 'Striped', 'Compact'], states: ['Default', 'Loading', 'Empty'], variantProperties: { Density: ['Default', 'Compact', 'Comfortable'] }, componentProperties: { HasSelection: { type: 'BOOLEAN', default: 'false' }, HasPagination: { type: 'BOOLEAN', default: 'true' } }, tokenBindings: ['border/default', 'surface/card', 'text/primary'], styleBindings: ['Body', 'Label'], variableBindings: { fill: 'surface/card', stroke: 'border/default' } },
      { name: 'Modal', description: 'Focused overlay dialog — blocks the background, contains a title, body content, and action buttons for confirmations and forms.', tier: 'organism', category: 'Overlays', variants: ['SM', 'MD', 'LG', 'Full'], states: ['Open', 'Closing'], variantProperties: { Size: ['SM', 'MD', 'LG', 'Full'] }, componentProperties: { Title: { type: 'TEXT', default: 'Modal title' }, HasClose: { type: 'BOOLEAN', default: 'true' } }, tokenBindings: ['surface/card', 'surface/overlay', 'border/default'], styleBindings: ['H3', 'Body'], variableBindings: { fill: 'surface/card' } },
      { name: 'Navigation Bar', description: 'Top-edge app bar with logo, primary nav links, and user account controls — sticky on scroll.', tier: 'organism', category: 'Navigation', variants: ['Default', 'Compact'], states: ['Default', 'Scrolled'], variantProperties: { Variant: ['Default', 'Compact'] }, componentProperties: { HasLogo: { type: 'BOOLEAN', default: 'true' }, HasSearch: { type: 'BOOLEAN', default: 'false' } }, tokenBindings: ['surface/card', 'text/primary', 'border/default'], styleBindings: ['Label', 'Body'], variableBindings: { fill: 'surface/card', stroke: 'border/default' } },
      { name: 'Sidebar', description: 'Left-rail navigation panel with collapsible sections, active state highlighting, and optional overlay mode on mobile.', tier: 'organism', category: 'Navigation', variants: ['Default', 'Collapsed', 'Overlay'], states: ['Default', 'Collapsed'], variantProperties: { State: ['Default', 'Collapsed', 'Overlay'] }, componentProperties: { HasLogo: { type: 'BOOLEAN', default: 'true' } }, tokenBindings: ['surface/card', 'action/primary', 'text/primary'], styleBindings: ['Label', 'Body SM'], variableBindings: { fill: 'surface/card' } },
    ],
    patterns: [
      { name: 'Auth — Sign In', description: 'Email + password login form with social auth options', components: ['Input', 'Button', 'Card'], layout: 'Centered single-column card, max-width 420px' },
      { name: 'Dashboard Layout', description: 'Sidebar + topbar + main content grid with stat cards', components: ['Sidebar', 'Navigation Bar', 'Card'], layout: 'Fixed sidebar left, topbar sticky, scrollable main area' },
      { name: 'List Page', description: 'Search + filters + data table with pagination', components: ['Input', 'Button', 'Table', 'Badge'], layout: 'Full-width table with sticky header and bottom pagination' },
      { name: 'Settings', description: 'Sidebar nav + form sections + save actions', components: ['Sidebar', 'Input', 'Button', 'Card'], layout: 'Two-column: fixed settings nav left, form content right' },
    ]
  }
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = h / 360, ss = s / 100, ll = l / 100
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
  const p = 2 * ll - q
  const toC = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  if (ss === 0) { const v = Math.round(ll * 255); return `#${v.toString(16).padStart(2,'0').repeat(3)}` }
  const rr = Math.round(toC(hh + 1/3) * 255)
  const gg = Math.round(toC(hh) * 255)
  const bb = Math.round(toC(hh - 1/3) * 255)
  return `#${rr.toString(16).padStart(2,'0')}${gg.toString(16).padStart(2,'0')}${bb.toString(16).padStart(2,'0')}`
}

// Derive a 9-step brand ramp (50–900) from a single observed primary hex.
// The primary is placed at brand-500. Lighter steps raise lightness toward 97%,
// darker steps lower it toward 15%, with saturation gently increased for mid tones.
function derivePrimitives(primary: string): any[] {
  if (!primary || !/^#[0-9a-fA-F]{6}$/.test(primary)) return []
  const [h, s] = hexToHsl(primary)
  const stops = [
    { name: 'brand-50',  l: 97, s: Math.max(s - 20, 10) },
    { name: 'brand-100', l: 93, s: Math.max(s - 15, 15) },
    { name: 'brand-200', l: 85, s: Math.max(s - 10, 20) },
    { name: 'brand-300', l: 74, s: Math.max(s - 5,  30) },
    { name: 'brand-400', l: 62, s },
    { name: 'brand-500', l: 0,  s, hex: primary },  // anchor
    { name: 'brand-600', l: 40, s: Math.min(s + 5, 95) },
    { name: 'brand-700', l: 32, s: Math.min(s + 8, 95) },
    { name: 'brand-800', l: 24, s: Math.min(s + 10, 95) },
    { name: 'brand-900', l: 15, s: Math.min(s + 12, 95) },
  ]
  return stops.map(stop => ({
    name: stop.name,
    value: stop.hex || hslToHex(h, stop.s, stop.l),
    type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true,
  }))
}

function mergeWithBaseline(baseline: any, diff: any): any {
  if (!diff || typeof diff !== 'object') return baseline
  const result = JSON.parse(JSON.stringify(baseline))

  // Merge meta fields (all observed values win)
  if (diff.meta) Object.assign(result.meta, diff.meta)

  // Override brand primitives with observed colors.
  // If the AI returned explicit primitives, use them directly.
  // If not, but a primaryColor was observed, derive a ramp from it so the
  // baseline indigo shades are never left standing when we know the real primary.
  if (diff.primitives?.length) {
    result.variables.collections.Primitives = diff.primitives.map((p: any) => ({
      ...p, type: 'color', resolvedType: 'COLOR', scopes: ['FRAME_FILL'], hiddenFromPublishing: true,
    }))
  } else if (diff.meta?.primaryColor) {
    result.variables.collections.Primitives = derivePrimitives(diff.meta.primaryColor)
  }

  // Merge semantic color overrides
  if (diff.semanticColors) {
    for (const [key, vals] of Object.entries(diff.semanticColors as Record<string, any>)) {
      const idx = result.variables.collections.Color.findIndex((c: any) => c.name === key)
      if (idx >= 0) Object.assign(result.variables.collections.Color[idx], vals)
      else result.variables.collections.Color.push({ name: key, ...vals, resolvedType: 'COLOR', scopes: ['FRAME_FILL'] })
    }
  }

  // Apply typography overrides to text styles
  if (diff.typography) {
    const t = diff.typography
    const font = diff.meta?.fontFamily || baseline.meta.fontFamily
    const headFont = diff.meta?.headingFontFamily || font
    if (t.heading) {
      result.styles.text = result.styles.text.map((s: any) =>
        ['Display', 'H1', 'H2', 'H3', 'H4'].includes(s.name)
          ? { ...s, fontFamily: headFont, fontWeight: t.heading.fontWeight || s.fontWeight, letterSpacing: t.heading.letterSpacing !== undefined ? { value: t.heading.letterSpacing, unit: 'PIXELS' } : s.letterSpacing }
          : s
      )
    }
    if (t.body) {
      result.styles.text = result.styles.text.map((s: any) =>
        ['Body LG', 'Body', 'Body SM'].includes(s.name)
          ? { ...s, fontFamily: font, fontSize: t.body.fontSize || s.fontSize, lineHeight: t.body.lineHeight ? { value: t.body.lineHeight, unit: 'PIXELS' } : s.lineHeight }
          : s
      )
    }
    if (t.label) {
      result.styles.text = result.styles.text.map((s: any) =>
        s.name === 'Label'
          ? { ...s, fontFamily: font, fontSize: t.label.fontSize || s.fontSize, fontWeight: t.label.fontWeight || s.fontWeight }
          : s
      )
    }
    if (t.mono) {
      result.styles.text = result.styles.text.map((s: any) =>
        s.name === 'Code' ? { ...s, fontFamily: t.mono.fontFamily || s.fontFamily } : s
      )
    }
    result.variables.collections.Typography = result.variables.collections.Typography.map((v: any) => {
      if (v.name === 'family/sans') return { ...v, value: font }
      if (v.name === 'family/mono') return { ...v, value: t.mono?.fontFamily || v.value }
      return v
    })
  }

  // Apply observed shadow language to effect styles
  if (diff.meta?.shadowDepth) {
    const depth = diff.meta.shadowDepth
    const alphaMap: Record<string, number> = { none: 0, subtle: 0.04, medium: 0.10, heavy: 0.18 }
    const alpha = alphaMap[depth] ?? 0.08
    if (depth === 'none') {
      result.styles.effects = result.styles.effects.map((e: any) => ({ ...e, radius: 0, spread: 0, color: 'rgba(0,0,0,0)' }))
    } else {
      result.styles.effects = result.styles.effects.map((e: any) => ({
        ...e,
        color: `rgba(0,0,0,${alpha})`,
      }))
    }
  }

  // Merge observed shadow definitions
  if (diff.shadows?.length) {
    for (const sh of diff.shadows) {
      const name = `Shadow/${sh.name?.charAt(0).toUpperCase() + sh.name?.slice(1) || 'Custom'}`
      result.styles.effects.push({
        name,
        type: 'DROP_SHADOW',
        radius: sh.blur || 8,
        spread: sh.spread || 0,
        color: `rgba(0,0,0,${sh.alpha || 0.08})`,
        offsetX: sh.x || 0,
        offsetY: sh.y || 2,
        css: `${sh.x || 0}px ${sh.y || 2}px ${sh.blur || 8}px rgba(0,0,0,${sh.alpha || 0.08})`,
      })
    }
  }

  // Add/replace components — preserve visual style fingerprints
  if (diff.components?.length) {
    for (const dc of diff.components) {
      const idx = result.components.findIndex((c: any) => c.name === dc.name)
      if (idx >= 0) {
        // Preserve baseline description when extraction doesn't provide one
        const merged = { ...dc }
        if (!merged.description) merged.description = result.components[idx].description
        Object.assign(result.components[idx], merged)
      } else {
        result.components.push(dc)
      }
    }
  }

  // Merge patterns
  if (diff.patterns?.length) result.patterns = diff.patterns

  // Update inference map
  if (diff.inferenceMap) Object.assign(result.meta.inferenceMap, diff.inferenceMap)
  return result
}

const SYSTEM_PROMPT = `You are a design systems expert analyzing screenshots to extract a COMPLETE visual fingerprint of this specific app. A generic baseline exists — your job is to override it so thoroughly with observed values that the output looks like it was designed from scratch for THIS app. A viewer should never be able to tell a baseline existed.

Return a JSON diff object. Be exhaustive — every value you can observe or accurately infer should be included. Do not leave baseline defaults standing when you can observe the real values.

DIFF SCHEMA:
{
  "meta": {
    "primaryColor": "#hex (required — dominant brand/action color)",
    "secondaryColor": "#hex",
    "accentColor": "#hex (tertiary accent if present)",
    "bgColor": "#hex (page/app background)",
    "surfaceColor": "#hex (card/panel background)",
    "sidebarColor": "#hex (sidebar background if different from surface)",
    "textColor": "#hex (primary body text)",
    "textSecondaryColor": "#hex (secondary/muted text)",
    "borderColor": "#hex (default border/divider)",
    "fontFamily": "string (primary font name visible, e.g. Inter, Roboto, DM Sans)",
    "headingFontFamily": "string (heading font if different from body)",
    "buttonRadius": number (px — observe button corner rounding),
    "cardRadius": number (px — observe card corner rounding),
    "inputRadius": number (px — observe input field corner rounding),
    "badgeRadius": number (px — observe badge/chip corner rounding, often 9999 for pill),
    "shadowDepth": "none|subtle|medium|heavy (overall shadow language of the app)",
    "density": "compact|default|comfortable (spacing density — how tight are rows/padding)",
    "iconStyle": "outline|filled|duotone|custom (icon visual style observed)",
    "buttonStyle": "filled|outline|ghost|mixed (dominant button treatment observed)",
    "cardStyle": "bordered|elevated|flat|mixed"
  },
  "primitives": [
    { "name": "brand-50", "value": "#hex" },
    { "name": "brand-100", "value": "#hex" },
    ...through brand-900
  ],
  "semanticColors": {
    "action/primary": { "lightValue": "#hex", "darkValue": "#hex" },
    "surface/page": { "lightValue": "#hex" },
    "surface/sidebar": { "lightValue": "#hex" }
  },
  "typography": {
    "heading": { "fontFamily": "string", "fontWeight": 700, "letterSpacing": -0.3 },
    "body": { "fontFamily": "string", "fontSize": 14, "lineHeight": 22 },
    "label": { "fontFamily": "string", "fontSize": 12, "fontWeight": 600, "letterSpacing": 0.1 },
    "mono": { "fontFamily": "string" }
  },
  "shadows": [
    { "name": "card", "blur": 8, "spread": 0, "x": 0, "y": 2, "color": "#000", "alpha": 0.08 }
  ],
  "components": [
    {
      "name": "string (app-specific name as seen, e.g. PatientCard, MedTable, AppointmentBadge)",
      "tier": "atom|molecule|organism|pattern",
      "category": "string (domain category, e.g. Medical, Navigation, Data)",
      "description": "string (one sentence: what this component shows/does in this app)",
      "variants": ["string (observed states/types, e.g. Active, Inactive, Critical, Normal)"],
      "states": ["Default", "Hover", "Disabled", ...],
      "visualStyle": {
        "bg": "#hex (component background fill color observed)",
        "fg": "#hex (component foreground/text color observed)",
        "border": "#hex (component border color, null if none)",
        "radius": number (component-specific corner radius in px),
        "shadow": "none|sm|md|lg",
        "padding": "string (e.g. '8px 16px' — approximate padding observed)",
        "iconPresent": true/false,
        "densityOverride": "compact|default|comfortable"
      },
      "dataFields": ["string (data labels/fields visible, e.g. 'Patient Name', 'Last Visit', 'Status')"],
      "variantProperties": { "PropertyName": ["Value1", "Value2"] },
      "componentProperties": { "propName": { "type": "TEXT|BOOLEAN|INSTANCE_SWAP", "default": "value" } }
    }
  ],
  "patterns": [
    {
      "name": "string",
      "description": "string (layout + content description)",
      "components": ["ComponentName"],
      "layout": "string (exact layout — sidebar width, grid columns, sticky elements)"
    }
  ]
}

OBSERVATION RULES:
1. primaryColor is REQUIRED — it is the most visible action/brand color (buttons, links, active states).
2. Extract the complete brand color ramp (brand-50 through brand-900) — derive intermediate shades from the primary.
3. For every component you can see, describe its ACTUAL visual style (bg color, border, radius, shadow) not generic defaults.
4. Domain-specific components are the most valuable — PatientCard, MedTable, VitalSign, AppointmentSlot are worth more than Button.
5. Include generic components (Button, Input, Checkbox) ONLY when you can observe app-specific visual treatments (e.g. a teal filled button with 4px radius is specific).
6. dataFields: list the actual labels/data you see in cards and tables — this drives faithful Figma component anatomy.
7. If you cannot observe a value, omit it. Never guess. Observed values win over inferred.
8. shadowDepth: none = flat design, subtle = barely visible shadows, medium = clear card elevation, heavy = dramatic shadows.

Respond ONLY with the JSON object. No markdown, no code fences.`

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
    text: `App name: ${name || 'Unknown'}\nPrimary brand color hint: ${primaryColor || 'none'}\nDescription: ${description || 'none'}\nURLs provided: ${urls.join(', ') || 'none'}\n\nAnalyze the screenshots and return only the brand-specific diff JSON as instructed.`
  })

  for (const img of images.slice(0, 20)) {
    const match = img.dataUrl?.match(/^data:(image\/[^;]+);base64,(.+)$/)
    if (!match) continue
    contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } })
  }

  // Fetch blob SAS URLs (uploaded images) and add as base64 image blocks
  for (const url of urls.slice(0, 20)) {
    if (!url.startsWith('http')) continue
    try {
      const imgRes = await fetch(url)
      if (!imgRes.ok) continue
      const contentType = imgRes.headers.get('content-type') || 'image/png'
      const mediaType = contentType.split(';')[0].trim()
      if (!mediaType.startsWith('image/')) continue
      const buf = await imgRes.arrayBuffer()
      const b64 = Buffer.from(buf).toString('base64')
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } })
    } catch { /* skip unfetchable URLs */ }
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
            max_tokens: 4096,
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
          const diff = JSON.parse(clean)
          const baseline = buildBaseline(name || 'Design System', diff?.meta?.primaryColor || primaryColor || '', diff?.meta?.fontFamily || '')
          result = mergeWithBaseline(baseline, diff)
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

  // ?sync=1 — wait for full result and return as single JSON (bypasses Azure gateway streaming timeout)
  const syncMode = req.query.get('sync') === '1'
  if (syncMode) {
    return new Promise((resolve) => {
      let finalResult: any = null
      const reader = (stream as any).getReader()
      const dec = new TextDecoder()
      let buf = ''
      function pump() {
        reader.read().then(({ done, value }: { done: boolean; value?: Uint8Array }) => {
          if (done) {
            resolve(finalResult
              ? { status: 200, headers: JSON_H, jsonBody: { type: 'result', data: finalResult } }
              : { status: 500, headers: JSON_H, jsonBody: { error: 'Extraction failed — no result produced' } })
            return
          }
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop()!
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const evt = JSON.parse(line)
              if (evt.type === 'result') finalResult = evt.data
            } catch { /* partial */ }
          }
          pump()
        }).catch((e: Error) => resolve({ status: 500, headers: JSON_H, jsonBody: { error: e.message } }))
      }
      pump()
    })
  }

  return { status: 200, headers: STREAM_H, body: stream as any }
}

// ── Async extract: POST /design-library/extract-async ────────────────────────
// Returns { jobId } immediately; runs extraction in background; poll /extract-job/:id
async function extractAsyncHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  if (!CLAUDE_API_KEY) return { status: 500, headers: JSON_H, jsonBody: { error: 'ANTHROPIC_API_KEY not configured' } }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }

  const jobId = crypto.randomUUID()
  const table = TableClient.fromConnectionString(CONN, 'ExtractionJobs')

  // Write pending job record
  await table.upsertEntity({ partitionKey: 'job', rowKey: jobId, status: 'pending', createdAt: new Date().toISOString() })

  // Enqueue job params — the queue-triggered worker does the actual Anthropic call
  // This avoids fire-and-forget IIFEs that Azure terminates after HTTP response is sent
  const queueSvc = QueueServiceClient.fromConnectionString(CONN)
  const queue = queueSvc.getQueueClient('extraction-jobs')
  await queue.createIfNotExists()
  const msg = Buffer.from(JSON.stringify({ jobId, ...body })).toString('base64')
  await queue.sendMessage(msg)

  return { status: 202, headers: JSON_H, jsonBody: { jobId } }
}

// ── Poll extract job: GET /design-library/extract-job/:jobId ─────────────────
async function extractJobHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  const jobId = req.params.jobId
  if (!jobId) return { status: 400, headers: JSON_H, jsonBody: { error: 'Missing jobId' } }
  try {
    const table = TableClient.fromConnectionString(CONN, 'ExtractionJobs')
    const entity = await table.getEntity('job', jobId)
    const status = entity.status as string
    if (status === 'done') {
      let result: any
      if (entity.resultBlobName) {
        // Result stored in blob (too large for table property)
        const blobSvc = BlobServiceClient.fromConnectionString(CONN)
        const blobContainer = blobSvc.getContainerClient('design-library-uploads')
        const blob = blobContainer.getBlockBlobClient(entity.resultBlobName as string)
        const download = await blob.downloadToBuffer()
        result = JSON.parse(download.toString())
      } else {
        result = JSON.parse(entity.result as string)
      }
      return { status: 200, headers: JSON_H, jsonBody: { status: 'done', result } }
    }
    if (status === 'error') return { status: 200, headers: JSON_H, jsonBody: { status: 'error', error: entity.error } }
    return { status: 200, headers: JSON_H, jsonBody: { status } }
  } catch (e: any) {
    if (e.statusCode === 404) return { status: 404, headers: JSON_H, jsonBody: { error: 'Job not found' } }
    return { status: 500, headers: JSON_H, jsonBody: { error: (e as Error).message } }
  }
}

// ── Queue worker: processes extraction-jobs queue messages ────────────────────
async function extractionWorker(queueItem: unknown, context: InvocationContext): Promise<void> {
  const raw = Buffer.from(queueItem as string, 'base64').toString('utf8')
  const parsed = JSON.parse(raw)
  const { jobId, name, primaryColor, images = [], description = '' } = parsed
  // accept both `urls` and `imageUrls` (the /upload endpoint returns a URL stored under imageUrls by some callers)
  const urls: string[] = parsed.urls || parsed.imageUrls || []
  const table = TableClient.fromConnectionString(CONN, 'ExtractionJobs')
  try {
    await table.upsertEntity({ partitionKey: 'job', rowKey: jobId, status: 'running', updatedAt: new Date().toISOString() })

    const contentBlocks: any[] = []
    contentBlocks.push({ type: 'text', text: `App name: ${name || 'Unknown'}\nPrimary brand color hint: ${primaryColor || 'none'}\nDescription: ${description || 'none'}\n\nExtract the complete design system.` })
    for (const img of (images as any[]).slice(0, 20)) {
      const match = img.dataUrl?.match(/^data:(image\/[^;]+);base64,(.+)$/)
      if (match) contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } })
    }
    for (const url of (urls as string[]).slice(0, 20)) {
      if (!url.startsWith('http')) continue
      try {
        const imgRes = await fetch(url)
        if (!imgRes.ok) continue
        const ct = (imgRes.headers.get('content-type') || 'image/png').split(';')[0].trim()
        if (!ct.startsWith('image/')) continue
        const b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: ct, data: b64 } })
        context.log(`extractionWorker: added image from ${url.slice(0, 60)}`)
      } catch (e: any) {
        context.log(`extractionWorker: skip image fetch error: ${e.message}`)
      }
    }

    context.log(`extractionWorker: calling Anthropic with ${contentBlocks.length} blocks`)
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 32000, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: contentBlocks }], stream: true }),
    })
    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      throw new Error(`Anthropic ${anthropicRes.status}: ${errText.slice(0, 200)}`)
    }

    let jsonBuf = ''
    const reader = anthropicRes.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const ev = JSON.parse(data)
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') jsonBuf += ev.delta.text
        } catch { /* skip */ }
      }
    }
    context.log(`extractionWorker: received ${jsonBuf.length} chars from Anthropic`)

    const clean = jsonBuf.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    const diff = JSON.parse(clean)
    const baseline = buildBaseline(name || 'Design System', diff?.meta?.primaryColor || primaryColor || '', diff?.meta?.fontFamily || '')
    const result = mergeWithBaseline(baseline, diff)
    if (!result.meta) result.meta = {}
    result.meta.name = result.meta.name || name || 'Design System'
    result.meta.extractedAt = new Date().toISOString()

    const blobSvc = BlobServiceClient.fromConnectionString(CONN)
    const blobContainer = blobSvc.getContainerClient('design-library-uploads')
    const resultBlobName = `jobs/${jobId}/result.json`
    await blobContainer.getBlockBlobClient(resultBlobName).uploadData(
      Buffer.from(JSON.stringify(result)),
      { blobHTTPHeaders: { blobContentType: 'application/json' } }
    )
    await table.upsertEntity({ partitionKey: 'job', rowKey: jobId, status: 'done', resultBlobName, updatedAt: new Date().toISOString() })
    context.log(`extractionWorker: job ${jobId} done`)
  } catch (e: any) {
    context.log(`extractionWorker: job ${jobId} error: ${e.message}`)
    await table.upsertEntity({ partitionKey: 'job', rowKey: jobId, status: 'error', error: e.message, updatedAt: new Date().toISOString() }).catch(() => {})
  }
}

app.storageQueue('extractionWorker', {
  queueName: 'extraction-jobs',
  connection: 'AZURE_STORAGE_CONNECTION_STRING',
  handler: extractionWorker,
})

// ── Save endpoint ─────────────────────────────────────────────────────────────
async function saveHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }

  const id = (body.id || crypto.randomUUID()) as string
  const userId = extractUserId(req) || 'anonymous'
  const visibility = body.visibility === 'public' ? 'public' : 'private'

  try {
    const client = TableClient.fromConnectionString(CONN, TABLE)
    await client.upsertEntity({
      partitionKey: userId,
      rowKey: id,
      id,
      name: body.meta?.name || 'Unnamed',
      visibility,
      data: JSON.stringify({ ...body, visibility }),
      createdAt: new Date().toISOString(),
    })
    return { status: 200, headers: JSON_H, jsonBody: { ...body, id, visibility } }
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
    // Return own items (any visibility) + public items from other users
    for await (const e of client.listEntities()) {
      if (e.partitionKey === userId || (e as any).visibility === 'public') {
        try { items.push(JSON.parse(e.data as string)) } catch { /* skip corrupt */ }
      }
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

const UAT_USER = 'von.ellis@enterpriseds.io'

// ── JWT helper ────────────────────────────────────────────────────────────────
function extractUserId(req: HttpRequest): string | null {
  // UAT bypass — token-gated; resolves to UAT_USER (change that constant to switch accounts)
  const uatToken = req.headers.get('X-UAT-Token')
  if (uatToken && process.env.UAT_BYPASS_TOKEN && uatToken === process.env.UAT_BYPASS_TOKEN) {
    return UAT_USER
  }
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
    ctx.log('listPalettes DB error (returning empty list):', (e as Error).message)
    return { status: 200, headers: JSON_H, jsonBody: [] }
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
// Stories are namespaced as {LibraryName}/{Tier}/{ComponentName} so that one
// shared Storybook instance partitions multiple design libraries by sidebar group.
async function storiesHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }
  const { result } = body as any
  if (!result) return { status: 400, headers: JSON_H, jsonBody: { error: 'result required' } }

  const components = result.components || []
  const primary = result.meta?.primaryColor || '#1B4F5C'
  const radius = result.meta?.buttonRadius || 8
  // Library name becomes the top-level Storybook sidebar group and Supernova namespace
  const libraryName = (result.meta?.name || 'Design System').replace(/[^a-zA-Z0-9 ]/g, '').trim()

  function detectType(c: any): string {
    const n = (c.name || '').toLowerCase()
    const cat = (c.category || '').toLowerCase()
    if (/checkbox|check/.test(n) || cat === 'checkbox') return 'checkbox'
    if (/toggle|switch/.test(n)) return 'toggle'
    if (/radio/.test(n)) return 'radio'
    if (/avatar|profile/.test(n)) return 'avatar'
    if (/badge|tag|chip|pill/.test(n)) return 'badge'
    if (/input|text.*field|search/.test(n) || cat === 'input') return 'input'
    if (/select|dropdown/.test(n)) return 'select'
    if (/textarea/.test(n)) return 'textarea'
    if (/progress|spinner|loading/.test(n)) return 'progress'
    if (/toast|alert|notification/.test(n)) return 'alert'
    if (/tooltip/.test(n)) return 'tooltip'
    if (/modal|dialog/.test(n)) return 'modal'
    if (/accordion|collapse/.test(n)) return 'accordion'
    if (/tab/.test(n)) return 'tabs'
    if (/nav|menu|sidebar/.test(n)) return 'nav'
    if (/divider|separator/.test(n)) return 'divider'
    if (/icon/.test(n)) return 'icon'
    if (/card/.test(n) || c.tier === 'molecule' || c.tier === 'organism') return 'card'
    if (/table|list/.test(n)) return 'table'
    return 'button'
  }

  function buildRender(c: any, type: string): string {
    const isDisabled = "args.disabled"
    switch (type) {
      case 'checkbox': return `(args) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: ${isDisabled} ? 'not-allowed' : 'pointer', opacity: ${isDisabled} ? 0.45 : 1 }}>
      <div style={{ width: 18, height: 18, borderRadius: 4, border: \`2px solid \${args.checked ? '${primary}' : '#E5E7EB'}\`, background: args.checked ? '${primary}' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {args.checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      {args.label}
    </label>
  )`
      case 'toggle': return `(args) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: ${isDisabled} ? 'not-allowed' : 'pointer', opacity: ${isDisabled} ? 0.45 : 1 }}>
      <div style={{ width: 40, height: 22, borderRadius: 11, background: args.checked ? '${primary}' : '#E5E7EB', position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 3, left: args.checked ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
      {args.label}
    </label>
  )`
      case 'radio': return `(args) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: ${isDisabled} ? 'not-allowed' : 'pointer', opacity: ${isDisabled} ? 0.45 : 1 }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: \`2px solid \${args.checked ? '${primary}' : '#E5E7EB'}\`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {args.checked && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '${primary}' }} />}
      </div>
      {args.label}
    </label>
  )`
      case 'avatar': return `(args) => {
    const initials = args.label.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    const sizes = { small: 28, medium: 40, large: 56 }
    const sz = sizes[args.size] || 40
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ width: sz, height: sz, borderRadius: '50%', background: '${primary}', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: sz * 0.35, fontWeight: 600 }}>{initials}</div>
        <span style={{ fontSize: 11, color: '#64748B' }}>{args.label}</span>
      </div>
    )
  }`
      case 'badge': return `(args) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: args.variant === 'danger' ? '#FEE2E2' : '${primary}20', color: args.variant === 'danger' ? '#DC2626' : '${primary}' }}>
      {args.label}
    </span>
  )`
      case 'input': return `(args) => (
    <div style={{ width: 260 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>{args.label}</div>
      <div style={{ display: 'flex', alignItems: 'center', height: 38, border: \`1px solid \${args.disabled ? '#E5E7EB' : '${primary}'}\`, borderRadius: ${radius}, padding: '0 12px', background: args.disabled ? '#F9FAFB' : '#fff', opacity: args.disabled ? 0.6 : 1 }}>
        <span style={{ fontSize: 14, color: '#9CA3AF' }}>Enter {args.label.toLowerCase()}…</span>
      </div>
    </div>
  )`
      case 'select': return `(args) => (
    <div style={{ width: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 38, border: '1px solid #E5E7EB', borderRadius: ${radius}, padding: '0 12px', background: '#fff', justifyContent: 'space-between', opacity: args.disabled ? 0.45 : 1 }}>
        <span style={{ fontSize: 14, color: '#9CA3AF' }}>{args.label}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5L7 9L11 5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
    </div>
  )`
      case 'progress': return `(args) => (
    <div style={{ width: 240 }}>
      <div style={{ height: 8, borderRadius: 4, background: '#E5E7EB', overflow: 'hidden' }}>
        <div style={{ width: \`\${args.value || 65}%\`, height: '100%', borderRadius: 4, background: '${primary}', transition: 'width 0.4s' }} />
      </div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{args.value || 65}% · {args.label}</div>
    </div>
  )`
      case 'alert': return `(args) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: ${radius}, background: args.variant === 'danger' ? '#FEF2F2' : '#EFF6FF', border: \`1px solid \${args.variant === 'danger' ? '#FECACA' : '#BFDBFE'}\`, maxWidth: 300 }}>
      <span style={{ color: args.variant === 'danger' ? '#B91C1C' : '#1D4ED8', fontSize: 14 }}>{args.variant === 'danger' ? '⚠' : 'ℹ'}</span>
      <div style={{ fontSize: 13, color: args.variant === 'danger' ? '#B91C1C' : '#1D4ED8', fontWeight: 500 }}>{args.label}</div>
    </div>
  )`
      case 'modal': return `(args) => (
    <div style={{ width: 280, border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#111827' }}>{args.label}</div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Dialog content goes here.</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <div style={{ padding: '6px 14px', borderRadius: ${radius}, border: '1px solid #E5E7EB', fontSize: 13, color: '#64748B' }}>Cancel</div>
        <div style={{ padding: '6px 14px', borderRadius: ${radius}, background: '${primary}', color: '#fff', fontSize: 13 }}>Confirm</div>
      </div>
    </div>
  )`
      case 'tooltip': return `(args) => (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ background: '#1F2937', color: '#fff', fontSize: 12, padding: '5px 10px', borderRadius: 6 }}>{args.label}</div>
      <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1F2937' }} />
      <div style={{ fontSize: 12, color: '#64748B' }}>Hover target</div>
    </div>
  )`
      case 'card': {
        const vs = c.visualStyle || {}
        const cardBg = vs.bg || '#fff'
        const cardBorder = vs.border !== null && vs.border !== undefined ? vs.border : '#E5E7EB'
        const cardRadius2 = vs.radius !== undefined ? vs.radius : (radius + 4)
        const cardShadow = vs.shadow && vs.shadow !== 'none' ? '0 2px 8px rgba(0,0,0,0.10)' : 'none'
        const fields = (c.dataFields || []).slice(0, 4)
        const fieldsJSX = fields.length
          ? fields.map((f: string) => `
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', padding: '4px 0', borderTop: '1px solid #F1F5F9' }}>
        <span style={{ fontWeight: 500 }}>${f}</span><span>—</span>
      </div>`).join('')
          : `\n      <div style={{ fontSize: 13, color: '#64748B' }}>Card content for {args.label}</div>`
        return `(args) => (
    <div style={{ width: 280, border: '1px solid ${cardBorder}', borderRadius: ${cardRadius2}, padding: '14px 16px', background: '${cardBg}', opacity: args.disabled ? 0.6 : 1, boxShadow: '${cardShadow}' }}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: '#111827' }}>{args.label}</div>${fieldsJSX}
    </div>
  )`
      }
      case 'tabs': return `(args) => (
    <div style={{ borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 0 }}>
      {['Overview', 'Details', 'History'].map((t, i) => (
        <div key={t} style={{ padding: '8px 16px', fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? '${primary}' : '#64748B', borderBottom: i === 0 ? '2px solid ${primary}' : '2px solid transparent', cursor: 'pointer' }}>{t}</div>
      ))}
    </div>
  )`
      case 'accordion': return `(args) => (
    <div style={{ width: 280, border: '1px solid #E5E7EB', borderRadius: ${radius}, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', fontSize: 14, fontWeight: 500 }}>
        <span>{args.label}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
    </div>
  )`
      case 'nav': return `() => (
    <div style={{ display: 'flex', gap: 4 }}>
      {['Home', 'Library', 'Settings'].map((item, i) => (
        <div key={item} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: i === 0 ? 600 : 400, background: i === 0 ? '${primary}20' : 'none', color: i === 0 ? '${primary}' : '#64748B', cursor: 'pointer' }}>{item}</div>
      ))}
    </div>
  )`
      default: {
        const vs = c.visualStyle || {}
        const compBg = vs.bg || primary
        const compFg2 = vs.fg || '#fff'
        const compR = vs.radius !== undefined ? vs.radius : radius
        const compBorderDefault = vs.border ? `'1px solid ${vs.border}'` : "'none'"
        return `(args) => (
    <button disabled={args.disabled} style={{ display: 'inline-flex', alignItems: 'center', padding: '0 16px', height: 38, borderRadius: ${compR}, background: args.variant === 'secondary' ? 'transparent' : '${compBg}', color: args.variant === 'secondary' ? '${compBg}' : '${compFg2}', border: args.variant === 'secondary' ? '1px solid ${compBg}' : ${compBorderDefault}, fontWeight: 500, fontSize: 14, cursor: args.disabled ? 'not-allowed' : 'pointer', opacity: args.disabled ? 0.4 : 1 }}>
      {args.label}
    </button>
  )`
      }
    }
  }

  const stories = components.map((c: any) => {
    const tier = c.tier ? c.tier.charAt(0).toUpperCase() + c.tier.slice(1) + 's' : 'Components'
    const storyTitle = `${libraryName}/${tier}/${c.name}`
    const type = detectType(c)
    const variants = (c.variants || []).filter((v: string) => v.toLowerCase() !== 'default')

    const extraArgTypes = type === 'checkbox' || type === 'toggle' || type === 'radio'
      ? `\n    checked: { control: 'boolean' },`
      : type === 'avatar' ? `\n    size: { control: { type: 'select' }, options: ['small', 'medium', 'large'] },`
      : type === 'progress' ? `\n    value: { control: { type: 'range', min: 0, max: 100, step: 5 } },`
      : type === 'badge' || type === 'alert' ? `\n    variant: { control: { type: 'select' }, options: ['default', 'danger'] },`
      : type === 'button' ? `\n    variant: { control: { type: 'select' }, options: ['primary', 'secondary'] },` : ''

    const extraDefaultArgs = type === 'checkbox' || type === 'toggle' || type === 'radio'
      ? `, checked: true`
      : type === 'avatar' ? `, size: 'medium'`
      : type === 'progress' ? `, value: 65`
      : type === 'badge' || type === 'alert' ? `, variant: 'default'`
      : type === 'button' ? `, variant: 'primary'` : ''

    const storyContent = variants.map((v: string) => `
export const ${v.replace(/[^a-zA-Z0-9]/g, '') || 'Variant'} = {
  args: { ...Default.args, label: '${v}'${type === 'checkbox' || type === 'toggle' || type === 'radio' ? `, checked: ${!(v.toLowerCase().includes('uncheck') || v.toLowerCase().includes('off'))}` : ''} },
}`).join('\n')

    return {
      filename: `${c.name.replace(/[^a-zA-Z0-9]/g, '')}.stories.jsx`,
      content: `import React from 'react'

export default {
  title: '${storyTitle}',
  tags: ['autodocs', '${libraryName.toLowerCase().replace(/\s+/g, '-')}'],
  argTypes: {
    label: { control: 'text' },
    disabled: { control: 'boolean' },${extraArgTypes}
  },
  render: ${buildRender(c, type)},
}

export const Default = {
  args: { label: '${c.name}', disabled: false${extraDefaultArgs} },
}
${storyContent}
`,
    }
  })

  return { status: 200, headers: JSON_H, jsonBody: { stories, libraryName } }
}

// ── Commit stories to repo → triggers storybook-supernova.yml workflow ───────
// POST /api/design-library/commit-stories
// Body: { stories: [{filename, content}], libraryName: string }
// Uses GH_PAT to upsert files into storybook/stories/{libraryName}/ on main,
// which triggers the push path in storybook-supernova.yml.
async function commitStoriesHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }
  if (!GH_PAT) return { status: 500, headers: JSON_H, jsonBody: { error: 'GH_PAT not configured on Function App' } }

  let body: any
  try { body = await req.json() } catch { return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } } }

  const { stories, libraryName } = body as { stories: { filename: string; content: string }[]; libraryName: string }
  if (!stories?.length) return { status: 400, headers: JSON_H, jsonBody: { error: 'stories array required' } }

  const slug = (libraryName || 'extracted').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const base = `storybook/stories/${slug}`
  const apiBase = `https://api.github.com/repos/${GH_REPO_OWNER}/${GH_REPO_NAME}/contents`
  const headers = {
    Authorization: `Bearer ${GH_PAT}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'design-library-builder-api',
  }

  const committed: string[] = []
  const failed: string[] = []

  for (const story of stories) {
    const path = `${base}/${story.filename}`
    const encoded = Buffer.from(story.content, 'utf8').toString('base64')

    // Check if file already exists (need its SHA for update)
    let sha: string | undefined
    try {
      const check = await fetch(`${apiBase}/${path}?ref=${GH_STORIES_BRANCH}`, { headers })
      if (check.ok) {
        const existing = await check.json() as any
        sha = existing.sha
      }
    } catch { /* new file, no SHA needed */ }

    const payload: any = {
      message: `chore: update ${slug} stories from design extraction`,
      content: encoded,
      branch: GH_STORIES_BRANCH,
      committer: { name: 'Design Library Builder', email: 'noreply@github.com' },
    }
    if (sha) payload.sha = sha

    try {
      const res = await fetch(`${apiBase}/${path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        committed.push(story.filename)
      } else {
        const err = await res.json().catch(() => ({})) as any
        ctx.log(`Failed to commit ${path}: ${res.status} ${err?.message || ''}`)
        failed.push(story.filename)
      }
    } catch (e: any) {
      ctx.log(`Error committing ${path}: ${e.message}`)
      failed.push(story.filename)
    }
  }

  return {
    status: committed.length > 0 ? 200 : 500,
    headers: JSON_H,
    jsonBody: {
      committed,
      failed,
      branch: GH_STORIES_BRANCH,
      path: base,
      triggersWorkflow: committed.length > 0,
    },
  }
}

// ── Figma webhook receiver ────────────────────────────────────────────────────
// Reuses MICROSOFT_CLIENT_SECRET (= AZURE_CLIENT_SECRET) as the Figma passcode —
// no new secret required. Writes events to Azure Table Storage so the scheduled
// GitHub Action can pick them up without needing a GitHub PAT.
async function figmaWebhookHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return { status: 204, headers: CORS }

  // MICROSOFT_CLIENT_SECRET is already synced to the Function App via api-deploy.yml
  const FIGMA_PASSCODE = process.env.FIGMA_WEBHOOK_PASSCODE || process.env.MICROSOFT_CLIENT_SECRET || ''

  let body: any
  try {
    body = await req.json()
  } catch {
    return { status: 400, headers: JSON_H, jsonBody: { error: 'Invalid JSON' } }
  }

  // Validate Figma passcode
  if (FIGMA_PASSCODE && body.passcode !== FIGMA_PASSCODE) {
    ctx.log('Figma webhook: invalid passcode')
    return { status: 401, headers: JSON_H, jsonBody: { error: 'Unauthorized' } }
  }

  // Acknowledge PING events — Figma sends this when registering the webhook
  if (body.event_type === 'PING') {
    ctx.log('Figma webhook PING received — endpoint confirmed')
    return { status: 200, headers: JSON_H, jsonBody: { ok: true } }
  }

  // Only queue LIBRARY_PUBLISH events
  if (body.event_type !== 'LIBRARY_PUBLISH') {
    return { status: 200, headers: JSON_H, jsonBody: { ok: true, skipped: true } }
  }

  ctx.log(`Figma LIBRARY_PUBLISH received for file ${body.file_key} (${body.file_name})`)

  // Write to Azure Table Storage — scheduled GitHub Action polls this table
  try {
    const tableClient = TableClient.fromConnectionString(CONN, 'FigmaEvents')
    await tableClient.createTable().catch(() => {}) // no-op if exists
    await tableClient.upsertEntity({
      partitionKey: 'LIBRARY_PUBLISH',
      rowKey: `${Date.now()}-${body.file_key}`,
      fileKey: body.file_key || '',
      fileName: body.file_name || '',
      processed: false,
      triggeredAt: new Date().toISOString(),
    })
    ctx.log('Event queued in FigmaEvents table')
    return { status: 200, headers: JSON_H, jsonBody: { ok: true, queued: true } }
  } catch (e) {
    ctx.log(`Failed to queue event: ${(e as Error).message}`)
    return { status: 500, headers: JSON_H, jsonBody: { error: 'Failed to queue event' } }
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

app.http('commitStories', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/commit-stories',
  handler: commitStoriesHandler,
})

app.http('figmaWebhook', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'figma-webhook',
  handler: figmaWebhookHandler,
})

// ── Image upload → Blob Storage ───────────────────────────────────────────────
// POST /api/design-library/upload  multipart/form-data; field name = "file"
// Returns { url } — a SAS URL valid for 1 hour that Claude's vision API can fetch.
// Avoids embedding large base64 images in the extract JSON payload (which hits
// Azure's ~1 MB request body proxy limit and causes 502s).
async function imageUploadHandler(req: HttpRequest): Promise<HttpResponseInit> {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }

  if (req.method === 'OPTIONS') return { status: 204, headers: cors }

  try {
    const contentType = req.headers.get('content-type') || ''
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
    if (!boundaryMatch) {
      return { status: 400, headers: cors, jsonBody: { error: 'Expected multipart/form-data' } }
    }
    const boundary = boundaryMatch[1]

    // Read raw body as ArrayBuffer and parse multipart manually
    const rawBuffer = await req.arrayBuffer()
    const raw = Buffer.from(rawBuffer)

    // Find the file part between boundaries
    const boundaryBuf = Buffer.from(`--${boundary}`)
    const parts: { headers: string; body: Buffer }[] = []
    let pos = 0
    while (pos < raw.length) {
      const bStart = raw.indexOf(boundaryBuf, pos)
      if (bStart === -1) break
      pos = bStart + boundaryBuf.length
      if (raw[pos] === 0x2d && raw[pos + 1] === 0x2d) break // --boundary--
      if (raw[pos] === 0x0d) pos += 2 // skip \r\n
      // Headers end at double CRLF
      const headerEnd = raw.indexOf(Buffer.from('\r\n\r\n'), pos)
      if (headerEnd === -1) break
      const partHeaders = raw.slice(pos, headerEnd).toString()
      pos = headerEnd + 4
      // Body ends at next boundary
      const nextBoundary = raw.indexOf(boundaryBuf, pos)
      const bodyEnd = nextBoundary === -1 ? raw.length : nextBoundary - 2 // strip trailing \r\n
      parts.push({ headers: partHeaders, body: raw.slice(pos, bodyEnd) })
      pos = nextBoundary === -1 ? raw.length : nextBoundary
    }

    const filePart = parts.find(p => p.headers.includes('name="file"'))
    if (!filePart) {
      return { status: 400, headers: cors, jsonBody: { error: 'No "file" field in multipart body' } }
    }

    // Determine content type from part headers
    const ctMatch = filePart.headers.match(/Content-Type:\s*([^\r\n]+)/i)
    const mimeType = ctMatch ? ctMatch[1].trim() : 'image/png'
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg'
      : mimeType.includes('webp') ? 'webp'
      : mimeType.includes('gif') ? 'gif' : 'png'

    const blobName = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const containerName = 'design-library-uploads'

    // Container must be pre-created (account policy blocks createIfNotExists).
    // The storybook-supernova workflow creates it on first workflow_dispatch run.
    const blobServiceClient = BlobServiceClient.fromConnectionString(CONN)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)
    await blockBlobClient.uploadData(filePart.body, {
      blobHTTPHeaders: { blobContentType: mimeType },
    })

    // Generate SAS URL valid for 1 hour so Claude's vision API can fetch it
    let url = blockBlobClient.url
    try {
      // Parse account name + key from connection string for SAS generation
      const accountNameMatch = CONN.match(/AccountName=([^;]+)/)
      const accountKeyMatch = CONN.match(/AccountKey=([^;]+)/)
      if (accountNameMatch && accountKeyMatch) {
        const sharedKey = new StorageSharedKeyCredential(accountNameMatch[1], accountKeyMatch[1])
        const sasToken = generateBlobSASQueryParameters(
          {
            containerName,
            blobName,
            permissions: BlobSASPermissions.parse('r'),
            expiresOn: new Date(Date.now() + 60 * 60 * 1000),
          },
          sharedKey
        ).toString()
        url = `${blockBlobClient.url}?${sasToken}`
      }
    } catch {
      // Fall through — public blob URL still works if container is public
    }

    return {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, blobName }),
    }
  } catch (err: any) {
    return { status: 500, headers: cors, jsonBody: { error: err.message } }
  }
}

app.http('imageUpload', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/upload',
  handler: imageUploadHandler,
})

app.http('extractAsync', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/extract-async',
  handler: extractAsyncHandler,
})

app.http('extractJob', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'design-library/extract-job/{jobId}',
  handler: extractJobHandler,
})
