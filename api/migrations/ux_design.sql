-- ux_design database — color_palettes table
-- Org-scoped color palettes shared across all team members

CREATE TABLE IF NOT EXISTS color_palettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT,
  bg_color TEXT,
  surface_color TEXT,
  text_color TEXT,
  border_color TEXT,
  primitives JSONB,
  color_tokens JSONB,
  style_colors JSONB,
  extracted_from_system_id TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_color_palettes_org ON color_palettes (org_id, created_at DESC);
