# Project Memory — Design Library Builder
Last updated: 2026-07-22 by session 7211a296

## Purpose & goals
Upload any screenshot (app, website, design) → extract a complete, exhaustive Figma-ready design system → save to library → push to Figma as real design tokens via a plugin → view rendered components in a Storybook iframe → sync to Supernova.

**Non-negotiable standard:** The extracted library must look like it was designed FROM SCRATCH for the uploaded app. A viewer should never be able to tell a baseline template existed. Every component, color, shadow, radius, and typography choice must be overridden by observed values from the upload.

## Architecture
- **Frontend (v2):** React + Vite, hash router, deployed as Azure Static Web App
  - URL: https://brave-coast-0274be70f.7.azurestaticapps.net
  - Key screens: Upload, Review, Showcase, Export, Libraries
  - Source: `v2/src/`
- **Backend:** Azure Functions (Node v4), HTTP triggers
  - URL: https://design-library-builder-api.azurewebsites.net/api
  - Source: `api/src/functions/designLibrary.ts` (single file, all routes)
- **Storybook:** Azure Static Web App — https://lively-field-0cff9e30f.7.azurestaticapps.net
- **Database:** Azure Table Storage (`DesignLibraries` table, shared org storage)
- **Auth:** MSAL browser (Microsoft OAuth) + Google OAuth; UAT bypass via `X-UAT-Token` header
- **Figma plugin:** `figma-plugin/` + served from `v2/public/figma-plugin/` as static assets
- **Supernova:** CLI v2.2.5; design system ID 844460; workspace ID 784731

## Schema snapshot
**DesignLibraries** (Azure Table Storage):
- `partitionKey` = userId from JWT (falls back to `'anonymous'`; UAT user = `'von.ellis@enterpriseds.io'`)
- `rowKey` = extraction UUID
- `visibility` = `'private'` | `'public'`
- `data` = full JSON-stringified extraction result

## Integrations
| Service | Purpose | Status | Key config |
|---|---|---|---|
| Anthropic/Claude | Design extraction via vision | active | `OPENAI_API_KEY` (named misleadingly) |
| Azure Table Storage | Save/list design libraries | active | `AZURE_STORAGE_CONNECTION_STRING` |
| Azure Blob Storage | Image uploads | active | container: `uploads` |
| Figma REST API | Push tokens to Figma | active | `FIGMA_ACCESS_TOKEN` |
| Supernova CLI | Import Storybook + sync tokens | active | `SUPERNOVA_TOKEN` / `SUPERNOVA_AUTH_TOKEN` |
| GitHub API (GH_PAT) | Commit story files | active | org secret `ghub_key` → Function App env `GH_PAT` |
| MSAL/Microsoft OAuth | User auth | active | `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` |
| Google OAuth | User auth | active | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |

## Key decisions
- [2026-07] Baseline + diff + merge extraction pattern: comprehensive baseline covers all Figma capabilities; Claude Vision extracts a diff of brand-specific overrides; merge applies to every layer
- [2026-07] Per-component `visualStyle` fingerprint: `{ bg, fg, border, radius, shadow, padding, iconPresent, densityOverride }` extracted per component, drives all renderers and story generation
- [2026-07] `?sync=1` endpoint used for CCR UAT (streaming `/extract` 502s through CCR proxy)
- [2026-07] UAT_USER hardcoded as `'von.ellis@enterpriseds.io'` in designLibrary.ts — change by instruction
- [2026-07] Figma plugin bundled as static assets in `v2/public/figma-plugin/` so Export page can fetch and zip them
- [2026-07] Component type detection via regex on name/category/tier — same logic in Showcase.jsx and plugin.js
- [2026-07] Mode A Playwright UAT blocked by CCR egress proxy (Chromium ERR_CONNECTION_RESET); curl/Node fetch work fine
- [2026-07] eds-claude-skills mandatory: remember + track-actions + define-acceptance-criteria + verify-work + verifier agent + design-library-uat for all tasks

## Feature status
| Feature | Status | Notes |
|---|---|---|
| Upload screenshot → blob storage | done | `/api/design-library/upload` multipart |
| Extract → Anthropic → design system | done | ~18s with baseline+diff approach |
| Baseline + diff + merge extraction | done | SYSTEM_PROMPT rewritten; mergeWithBaseline applies all overrides |
| Per-component visualStyle fingerprints | done | Extracted and applied in Showcase + storiesHandler |
| Component-type-aware rendering in Showcase | done | 20+ types: checkbox, toggle, avatar, badge, input, card, table, etc. |
| storiesHandler generates real JSX | done | Type-specific stories with dataFields for cards |
| Figma plugin (manifest + plugin.js + ui.html) | done | Creates variables/styles/components in Figma from design-system.json |
| Export → Figma Plugin Bundle zip | done | Fetches static assets from v2/public/figma-plugin/, zips with JSZip |
| Save to DesignLibraries table | done | `/api/design-library/save` with visibility toggle |
| List saved libraries | done | `/api/design-library/saved` |
| Storybook build + deploy | done | `storybook-supernova.yml` |
| Supernova import | done | Confirmed success run 29861132546 |
| Push to Figma | done | `/api/design-library/push-figma` |
| Commit stories to repo | done | `/api/design-library/commit-stories` via GH_PAT |
| Sign out (MSAL) | done | Manually clears `msal.*` localStorage keys + forces reload |
| Mode A Playwright UAT | blocked | Chromium ERR_CONNECTION_RESET through CCR egress proxy — user must verify manually in browser |

## Known issues & gotchas
- Chromium cannot reach external HTTPS through CCR egress proxy — Mode A UAT must be done by user in browser or in a CCR env with browser-capable egress
- `/extract` streaming 502s through CCR proxy — always use `?sync=1` or `extract-async` from CCR
- `OPENAI_API_KEY` env var name is misleading — it holds the Anthropic key
- `SUPERNOVA_AUTH_TOKEN` is the GitHub org secret name; Function App env var is `SUPERNOVA_TOKEN`
- `GH_PAT` Function App env var comes from org secret `ghub_key`
- MSAL localStorage keys must be cleared manually on sign out (MSAL browser sign out alone leaves stale state)
- DesignLibraries table starts empty — Libraries tab shows "no libraries" until a real extraction is saved
- eds-claude-skills skills not auto-loaded by Skill tool unless repo is registered via `register_repo_root`

## Active work
Current task: none — session 7211a296 complete
Last completed: Merged PR #1 (component-type-aware rendering + Figma plugin + visual fingerprint extraction); ran UAT pipeline end-to-end (uat-extract.yml ✅, storybook-supernova.yml ✅); wired eds-claude-skills mandatory skills into Stop hook + bootstrapped memory.md and actions.md
Next step: User to verify UI manually at https://brave-coast-0274be70f.7.azurestaticapps.net as von.ellis@enterpriseds.io — confirm Showcase renders typed components (not blue buttons), Libraries tab shows saved library, Export downloads real Figma plugin zip
