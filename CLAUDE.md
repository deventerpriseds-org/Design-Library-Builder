# Design Library Builder

## Azure Infrastructure

- **Resource Group**: EnterpriseDS_ResourceGRP
- **Subscription**: 09594120-1b35-4e21-84c6-451ac27175a3
- **Tenant**: ee633423-c321-413c-a191-ace8b07e4196
- **Region**: eastus
- **Function App**: `design-library-builder-api` (design-library-builder-api.azurewebsites.net) — this app's own API
- **Frontend (v2 app)**: Static Web App deployed by `.github/workflows/deploy-app-v2.yml`. When someone says "the app", this is it.
- **Storybook**: Static Web App `design-library-builder-storybook` — deployed by `storybook-supernova.yml` after each build
- **Storage Account**: n8nstxpdthydai6fkm (shared org storage)
- **Storage Tables**: `DesignLibraries` (saved extractions), `FigmaEvents` (Figma webhook queue), `AppConfig`
- **Storage Container**: `uploads` (image uploads via `/api/upload-image`)
- **Node runtime**: 22

> **Not this repo**: `job-platform-api` and `executive-engine-web` belong to a separate app (Job Application Platform) in the same Azure subscription. Do not reference or deploy to those resources from here.

## Azure CLI Auth (for Claude Code sessions)

If `AZURE_CLIENT_ID` env var is set (CCR environment), login with:
```bash
az login --service-principal \
  -u $AZURE_CLIENT_ID \
  -p $AZURE_CLIENT_SECRET \
  --tenant $AZURE_TENANT_ID
az account set --subscription $AZURE_SUBSCRIPTION_ID
```

Otherwise use device code:
```bash
az login --use-device-code --allow-no-subscriptions
az account list --refresh --all
az account set --subscription 09594120-1b35-4e21-84c6-451ac27175a3
```

## GitHub Secrets (source of truth)

**ALL credentials live in GitHub org secrets.** The `api-deploy.yml` workflow syncs them onto the Function App on every deploy. Do NOT ask the user for keys — check `/api/config-status` if a route fails.

| Secret | Purpose |
|--------|---------|
| `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Service principal (also synced as `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`) |
| `AZURE_TENANT_ID` | ee633423-c321-413c-a191-ace8b07e4196 |
| `AZURE_SUBSCRIPTION_ID` | 09594120-1b35-4e21-84c6-451ac27175a3 |
| `AZURE_STORAGE_CONNECTION_STRING` | Shared org storage account |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_STORYBOOK` | Storybook SWA deploy token |
| `OPENAI_API_KEY` | Design extraction Claude/OpenAI calls |
| `FIGMA_ACCESS_TOKEN` | Figma REST API (push to Figma) |
| `FIGMA_WEBHOOK_PASSCODE` | Validates incoming Figma LIBRARY_PUBLISH webhooks (reuses `MICROSOFT_CLIENT_SECRET` value — same string, no new secret) |
| `SUPERNOVA_TOKEN` | Supernova CLI authentication |
| `SUPERNOVA_WORKSPACE_ID` | Supernova workspace (or resolved dynamically from token) |
| `Azure_admin_pw` | **⚠ note casing** — Postgres `Admin_eds` password → synced as `AZURE_PG_PASSWORD` |
| `GH_PAT` | GitHub PAT with `contents:write` on this repo. Used by `/commit-stories` to push story files and trigger the Storybook workflow. Synced to the Function App via `api-deploy.yml` using org secret `ghub_key` (the PAT lives there — `GH_PAT` is just the Function App env var name). During UAT this was missing until corrected; story files were committed directly via git as a workaround — the pipeline is otherwise complete. |

When adding a new secret: add it to GitHub secrets **and** to the `--settings` list in `.github/workflows/api-deploy.yml` (exact-name match — mismatch silently blanks the setting).

## UAT / Testing Rules

### CCR environment limitation — extract endpoint cannot be called from Claude sessions

`POST /design-library/extract` **streams NDJSON**. The CCR outbound proxy does not support streaming HTTP responses and returns 502 immediately. This means:

- **Claude cannot run end-to-end UAT from a CCR session.** Upload works (multipart/form-data, no streaming). Extract does not.
- **Do NOT attempt to call `/extract` via curl or Python from this environment.** It will always 502 — this is a proxy limitation, not a bug in the code.
- **The user must run UAT in the browser** at https://brave-coast-0274be70f.7.azurestaticapps.net, sign in with Microsoft, and walk the Upload → Extract → Export (Save) → Libraries flow themselves.
- Claude can verify individual steps before and after: use GitHub Actions workflows (with org secrets) to check table contents, check workflow run conclusions, and hit non-streaming endpoints (`/health`, `/upload`, `/saved`, `/save`).

### DesignLibraries table — save/list model

- Table: `DesignLibraries` (Azure Table Storage, shared org storage account)
- `partitionKey` = userId extracted from JWT (`extractUserId(req)`) — falls back to `'anonymous'` if no auth header
- `rowKey` = extraction id (UUID)
- `visibility` field: `'private'` (default) or `'public'` (opt-in at save time)
- **listHandler** returns: own rows (any visibility) + rows from other partitions where `visibility = 'public'`
- **The table starts empty.** Libraries tab shows "no libraries" until the user runs a real extraction and saves it via Export → Save Library.

### Verifying table contents without user involvement

Use the `debug-table.yml` workflow (workflow_dispatch) — it reads `AZURE_STORAGE_CONNECTION_STRING` from org secrets and lists all entities. Trigger it, check the run logs. This is the correct way to verify saves without asking the user.

---

**Never pass UAT with placeholder, demo, fake, or assumed data.** Every test must flow through the real pipeline:
- Extraction must use actual uploaded screenshots or a real Figma URL — not hardcoded mock results
- Story commit must write real component files generated from the extraction result to the repo
- Storybook build must include those committed files — not pre-written demo stories
- Supernova sync must receive the live deployed Storybook URL with real content
- Any endpoint test that uses `{}` or dummy data counts as a smoke test only, not UAT

**UAT is not complete until every step is confirmed working end-to-end — not assumed, not inferred from a successful API response.**

A workflow run returning `triggersWorkflow: true` is NOT confirmation the workflow passed.
A commit landing in the repo is NOT confirmation Storybook built.
An API returning 200 is NOT confirmation the downstream effect happened.

**You must check the actual GitHub Actions run result for the storybook-supernova.yml workflow and confirm `conclusion: success` before declaring UAT complete on the Storybook step.** If the build is failing, report it as a blocker — do not declare UAT done and do not fabricate a passing state.

### Current known pipeline status (last verified 2026-07-16)

| Step | Status | Notes |
|------|--------|-------|
| Upload image → Azure Blob | ✅ Working | `/api/design-library/upload` |
| Extract → Anthropic → design system | ✅ Working | ~18s with baseline+diff approach |
| `/stories` → generate story files | ✅ Working | 14 files for MedSync |
| `/commit-stories` → push to repo | ✅ Working | Uses org secret `ghub_key` → Function App env `GH_PAT` |
| Storybook build (`storybook-supernova.yml`) | ✅ Working | Confirmed `conclusion: success` on run 29496374325 |
| Deploy Storybook to SWA | ✅ Working | https://lively-field-0cff9e30f.7.azurestaticapps.net |
| Supernova import (`storybook-import`) | ✅ Working | Confirmed `conclusion: success` on run 29496374325 — design system 844460 |
| v2 app | ✅ Working | https://brave-coast-0274be70f.7.azurestaticapps.net |

**Supernova CLI notes (v2.2.5):**
- `describe-workspaces` uses `--apiKey` flag — workspace EDS id: 784731, design system "My Design System" id: 844460
- `storybook-import` does NOT use `--apiKey` — reads `SUPERNOVA_TOKEN` env var automatically
- Secret name in GitHub org: `SUPERNOVA_AUTH_TOKEN` (not `SUPERNOVA_TOKEN`)

## Deploy Commands

```bash
# Build API
cd api && npm ci && npm run build

# Deploy API (zip deploy)
cd api && zip -r /tmp/api-deploy.zip . --exclude '*.ts' --exclude 'src/*'
az functionapp deployment source config-zip \
  --name design-library-builder-api \
  --resource-group EnterpriseDS_ResourceGRP \
  --src /tmp/api-deploy.zip
```

## Key API Endpoints

All on `https://design-library-builder-api.azurewebsites.net/api/`:

| Endpoint | Purpose |
|----------|---------|
| `GET  /health` | Health + config status check |
| `POST /design-library/extract` | Run Claude design extraction (streams NDJSON progress) |
| `POST /design-library/push-figma` | Push extracted tokens back to Figma |
| `POST /design-library/patch-figma` | Patch existing Figma tokens |
| `POST /design-library/stories` | Generate Storybook story files from extraction result |
| `POST /design-library/upload` | Image upload to blob storage (`multipart/form-data`) |
| `POST /design-library/save` | Save extraction result |
| `GET  /design-library/saved` | List saved extractions |
| `GET  /design-library/palettes` | List org palettes |
| `POST /design-library/palettes` | Save org palette |
| `POST /design-library/commit-stories` | Commit generated `.stories.jsx` files to repo via GitHub API → triggers Storybook build |
| `POST /figma-webhook` | Receives Figma LIBRARY_PUBLISH events → queues to `FigmaEvents` table |
| `POST /auth/session` | Auth session |
| `POST /auth/google/token` | Google OAuth token exchange |

> **Route prefix**: all design-library routes use `/design-library/` — NOT bare names like `/extract` or `/stories`.

## Pipeline Architecture

```
Designer publishes Figma library
  → LIBRARY_PUBLISH webhook → /figma-webhook (Azure Function)
    → queues event to FigmaEvents table
      → storybook-supernova.yml (polls every 5 min)
        ├── Builds Storybook
        ├── Deploys to design-library-builder-storybook SWA
        ├── supernova import-storybook
        └── supernova sync-tokens

User clicks Push in app
  ├── PATCH_RESULT (app state)
  ├── POST /push-figma (Figma tokens)
  └── POST /stories → .stories.jsx committed to repo
        → storybook-supernova.yml triggers on push to storybook/stories/**
```

## Supernova CLI

Installed globally: `supernova` (`@supernovaio/cli` v2.2.5)

```bash
supernova import-storybook --token $SUPERNOVA_TOKEN --workspace $WS_ID --url $STORYBOOK_URL
supernova sync-tokens --token $SUPERNOVA_TOKEN --workspace $WS_ID
```

## tsconfig note

The `lib` must include `"DOM"` for Azure SDK compatibility:
```json
"lib": ["ES2020", "DOM"]
```

## Git workflow (branch discipline)

Branch discipline exists to **avoid conflicts and lost work by staying synced** — NOT to treat `main` as untouchable. Do the sync yourself; don't hand it to the user.

- **Develop** on the session's feature branch and push there.
- **Before pushing new work**, fetch `main` and check whether it has diverged (`git log main..origin/main`). If it's ahead, sync first (merge `origin/main` into the feature branch).
- **Merging to `main` is part of the job** — don't punt it to the user.
- After any merge: `npm run build` in `api/`, check for duplicate route registrations, smoke-test live endpoints.
