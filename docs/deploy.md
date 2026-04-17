# Deployment Guide

## Prerequisites

- Azure subscription with contributor access
- GitHub account
- Azure CLI installed (`az --version`)
- Node.js 20 LTS

## Step 1: Provision Azure Infrastructure

```bash
# Login to Azure
az login

# Deploy infrastructure (creates all resources)
az deployment sub create \
  --location eastus2 \
  --template-file infra/main.bicep \
  --parameters env=prod baseName=eventcompanion tenantId=<YOUR_TENANT_ID>
```

This creates:
- Resource group `rg-eventcompanion-prod`
- Azure Storage Account (Table Storage)
- Azure SignalR Service (serverless)
- Azure Key Vault
- Application Insights + Log Analytics
- Azure Static Web Apps (Standard)

## Step 2: Create GitHub Repository

1. Create a new repository under your GitHub account
2. Push this code to the `main` branch:

```bash
cd "CSU All Hands Interactive Activity"
git init
git add .
git commit -m "Initial commit: Event Companion"
git remote add origin https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git
git branch -M main
git push -u origin main
```

## Step 3: Connect SWA to GitHub

### Option A: Azure Portal
1. Go to Azure Portal → your Static Web App resource
2. Click **Deployment** → **Manage deployment token**
3. Copy the token

### Option B: Azure CLI
```bash
az staticwebapp secrets list \
  --name eventcompanion-swa-prod \
  --resource-group rg-eventcompanion-prod \
  --query "properties.apiKey" -o tsv
```

## Step 4: Configure GitHub Secret

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Create secret: `AZURE_STATIC_WEB_APPS_API_TOKEN` = (paste the deploy token)

## Step 5: Configure SWA Build Settings

The workflow uses these locations (already configured in `.github/workflows/azure-static-web-app.yml`):

| Setting | Value |
|---------|-------|
| `APP_LOCATION` | `apps/web` |
| `API_LOCATION` | `apps/api` |
| `OUTPUT_LOCATION` | `out` |

## Step 6: Configure Entra ID (for /control auth)

1. Go to Azure Portal → Entra ID → App registrations → New registration
2. Name: `EventCompanion-Auth`
3. Redirect URI: `https://<your-swa-hostname>/.auth/login/aad/callback`
4. Copy the **Application (client) ID** and create a **Client secret**
5. In SWA → Configuration → Application settings:
   - `AAD_CLIENT_ID` = your App registration client ID
   - `AAD_CLIENT_SECRET` = your client secret value

## Step 7: Set SWA Application Settings

In Azure Portal → Static Web App → Configuration → Application settings, add:

| Key | Value |
|-----|-------|
| `STORAGE_CONNECTION_STRING` | (from Storage Account keys or Bicep output) |
| `SIGNALR_CONNECTION_STRING` | (from SignalR keys) |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | (from App Insights) |

> **Note:** The Bicep template already sets these via `swaAppSettings`. Verify they're present.

## Step 8: Deploy

Push to `main` or create a PR. The GitHub Action will:
1. Run quality gates (lint, typecheck, tests, audit)
2. Build and deploy to SWA

## Step 9: Verify

Your app is live at:
```
https://<your-swa-hostname>.azurestaticapps.net
```

Test the flows:
1. Go to `/control/CSU2026` → create event + seed templates
2. Open `/display/CSU2026` on the projector
3. Scan QR or visit `/e/CSU2026` on your phone
4. Launch a question from control → see it on display + audience pages

## Custom Domain (Optional)

```bash
az staticwebapp hostname set \
  --name eventcompanion-swa-prod \
  --hostname events.contoso.com
```

## Troubleshooting

- **API 500 errors:** Check SWA Application Settings are set correctly
- **SignalR not connecting:** Verify SIGNALR_CONNECTION_STRING and CORS settings
- **Auth not working:** Verify Entra App Registration redirect URI matches SWA hostname
- **Build fails:** Check Node.js version (20) in GitHub Actions
