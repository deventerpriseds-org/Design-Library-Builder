# UAT Profile — Design Library Builder

## App
- **URL**: https://brave-coast-0274be70f.7.azurestaticapps.net
- **API**: https://design-library-builder-api.azurewebsites.net/api
- **UAT user**: dev@enterpriseds.io (hardcoded in `api/src/functions/designLibrary.ts` as `UAT_USER`)
- **Auth**: `X-UAT-Token: $UAT_BYPASS_TOKEN` header — no OAuth flow needed

## Goal experience

Designer uploads a screenshot of a UI → app extracts a full design system (colors, typography, spacing, components) → designer exports/saves the library → library appears in the Libraries tab → optionally pushed to Figma or Storybook.

## User journeys (ordered, for Playwright)

### Journey 1 — Extract and save a design system
1. Navigate to app URL
2. Upload a screenshot (drag-drop or file picker on the main screen)
3. Observe extraction progress — spinner, then design system preview appears
4. Review extracted components, colors, typography
5. Click **Export** → **Save Library**
6. Toggle visibility (Private / Public)
7. Confirm save — success state visible
8. Navigate to **Libraries** tab
9. Confirm saved library appears with correct name and visibility badge

**Input**: PNG/JPG screenshot of a UI  
**Output**: Design system record in `DesignLibraries` table (partitionKey = UAT user email)  
**Verify**: `GET /api/design-library/saved` with UAT token returns the saved library

### Journey 2 — Libraries tab (authenticated view)
1. Navigate to app URL
2. Click **Libraries** tab
3. Confirm own libraries are listed (private + public)
4. Confirm public libraries from other users appear
5. No "no libraries" empty state if Journey 1 has run

**Input**: Authenticated session as dev@enterpriseds.io  
**Output**: Library list rendered correctly  
**Verify**: Count matches `GET /api/design-library/saved` response

### Journey 3 — Push to Figma (if Figma token configured)
1. Complete Journey 1
2. Click **Push to Figma**
3. Confirm success response — tokens pushed to Figma file

**Handoff**: Figma file updated with extracted design tokens

## Regression guards (check on every deploy)

- Health: `GET /api/health` → `{ ok: true, hasAnthropicKey: true, hasStorageConn: true }`
- Upload: `POST /api/design-library/upload` (multipart) → `{ url, blobName }`
- Extract sync: `POST /api/design-library/extract?sync=1` → `{ type: 'result', data: { meta, components, variables } }`
- Save: `POST /api/design-library/save` with UAT token → 200 + full object
- List: `GET /api/design-library/saved` with UAT token → array containing saved item

## Known constraints

- `/extract` (streaming) 502s through CCR proxy — always use `?sync=1` or `extract-async`
- Libraries tab shows empty until at least one extraction is saved as this user
- `partitionKey` = UAT user email when bypass token is present
- Storybook/Supernova handoff requires `storybook-supernova.yml` — verify via GitHub Actions `conclusion: success`
