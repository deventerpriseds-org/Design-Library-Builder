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
- **Storage Tables**: `FigmaEvents` (Figma webhook queue), `AppConfig`
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

When adding a new secret: add it to GitHub secrets **and** to the `--settings` list in `.github/workflows/api-deploy.yml` (exact-name match — mismatch silently blanks the setting).

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
| `POST /extract` | Run Claude design extraction on Figma URL |
| `POST /push-figma` | Push extracted tokens back to Figma |
| `POST /stories` | Generate Storybook story files from extraction result |
| `POST /upload-image` | Image upload to blob storage (bypasses proxy body-size limit) |
| `POST /figma-webhook` | Receives Figma LIBRARY_PUBLISH events → queues to `FigmaEvents` table |
| `GET /health` | Health + config status check |

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
