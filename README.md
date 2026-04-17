# Event Companion – CSU All Hands Interactive Activity

A production-grade, Microsoft-internal-compliant real-time interactive web app for in-person events.
Built with Next.js, Fluent UI v9, Azure Functions, Azure SignalR Service, and Azure Table Storage.

## Features

- **Live Word Cloud** – Audience submits words/phrases; see them grow in real time on the projector.
- **Live Poll** – Single or multi-choice polls with animated bar charts.
- **Live Quiz** – Timed MCQ with leaderboard, speed bonus, and anti-cheat.

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (TypeScript) + Fluent UI React v9 + Framer Motion |
| Hosting | Azure Static Web Apps (Standard) |
| API | Azure Functions (Node 20 / TypeScript) |
| Real-time | Azure SignalR Service (Serverless mode) |
| Data | Azure Table Storage |
| Secrets | Azure Key Vault + Managed Identity |
| Auth | Microsoft Entra ID (admin /control) |
| Observability | Application Insights + Log Analytics |
| Edge | Azure Front Door Premium + WAF (optional) |

## Three Views

| Route | Purpose |
|-------|---------|
| `/e/[eventCode]` | Join page (QR + short URL) |
| `/live/[eventCode]` | Audience answering UI |
| `/display/[eventCode]` | Projector full-screen visuals |
| `/control/[eventCode]` | Admin control panel (Entra-only) |

## Quick Start (Local Dev)

```bash
# Install dependencies
cd apps/web && npm ci
cd ../api && npm ci

# Start API (Azure Functions)
cd apps/api && npm start

# Start frontend
cd apps/web && npm run dev
```

## Deployment

See [docs/deploy.md](docs/deploy.md) for full Azure deployment instructions.

## Documentation

- [Deployment Guide](docs/deploy.md)
- [Runbook](docs/runbook.md)
- [Compliance](docs/compliance.md)
- [Security](docs/security.md)
- [Performance](docs/perf.md)

## License

MIT – See [LICENSE](LICENSE)
