# Compliance Documentation

## Identity & Access

### Authentication
- **Admin (/control):** Microsoft Entra ID (Azure AD) OIDC via SWA built-in auth
  - Only `authenticated` role can access `/control/*`
  - Configured via `staticwebapp.config.json` route rules
  - 401 responses redirect to `/.auth/login/aad`
- **Audience:** Anonymous by default (configurable per event via `allowAnonymous` flag)
  - No PII collected; optional nickname only
  - Device tracked via random UUID in localStorage (not a persistent identifier)

### Authorization Model
| Route | Required Role |
|-------|---------------|
| `/control/*` | `authenticated` (Entra ID) |
| `/api/*` | `anonymous` or `authenticated` |
| All other routes | `anonymous` or `authenticated` |

## Secrets Management

### No Secrets in Code
- All secrets stored in **Azure Key Vault**
- SWA Application Settings injected at runtime (not in repo)
- `local.settings.json` is gitignored; `local.settings.example.json` has placeholder values only
- GitHub Actions uses only `AZURE_STATIC_WEB_APPS_API_TOKEN` (SWA deployment token)

### Secrets Inventory
| Secret | Location | Rotation |
|--------|----------|----------|
| Storage connection string | Key Vault + SWA App Settings | Auto (Key Vault) |
| SignalR connection string | Key Vault + SWA App Settings | Manual rotation |
| App Insights key | SWA App Settings | N/A (not sensitive) |
| Entra Client Secret | SWA App Settings | 6-month rotation recommended |
| SWA Deploy Token | GitHub Secret | Rotate after team changes |

## Telemetry & Observability

### Application Insights
- Integrated via `APPINSIGHTS_INSTRUMENTATIONKEY` in Azure Functions
- Tracks: request count, latency, errors, dependency calls
- **No PII** in telemetry (nicknames are optional, deviceIds are random UUIDs)
- Log Analytics workspace for querying and dashboards

### Structured Logging
- Azure Functions use built-in `context.log` / `context.error`
- All errors logged with context (function name, eventCode)
- No sensitive data in log messages

## Data Governance

### Data Minimization
- Only data necessary for interaction is collected:
  - `eventCode`, `questionId`, `answer`, `deviceId` (random UUID), optional `nickname`
- No emails, names, IP addresses, or user agents stored in Table Storage
- Device IDs are random and reset if user clears localStorage

### Retention & Deletion
- Events have configurable `retentionDays` (default: 30)
- Application-level cleanup handles expired data based on retention period
- **Manual deletion:** `/control` panel has "Delete Event" which removes all related data
- Key Vault has soft delete (7 days) for accidental secret deletion

### Export
- Results exportable as CSV or JSON from `/control` panel
- Export includes: response ID, eventCode, questionId, deviceId, nickname, answer, timestamp
- No additional PII beyond what user voluntarily provided

## OSS / Dependency Hygiene

### Dependency Policy
- Minimal direct dependencies
- All versions pinned in `package.json` (exact versions)
- `npm audit` runs in CI on every PR

### License Inventory
| Package | License |
|---------|---------|
| next | MIT |
| react / react-dom | MIT |
| @fluentui/react-components | MIT |
| @fluentui/react-icons | MIT |
| @microsoft/signalr | MIT |
| framer-motion | MIT |
| qrcode.react | ISC |
| @azure/data-tables | MIT |
| @azure/identity | MIT |
| @azure/keyvault-secrets | MIT |
| @azure/functions | MIT |
| applicationinsights | MIT |
| uuid | MIT |

### Automated Scanning
- `npm audit --audit-level=high` in CI pipeline
- Dependabot or GitHub Security Alerts recommended for ongoing monitoring

## Regulatory Considerations
- No user authentication data stored in application database
- GDPR: minimal data collection; "Delete Event" provides data erasure capability
- Data residency: configurable via Azure region selection (default: East US 2)
