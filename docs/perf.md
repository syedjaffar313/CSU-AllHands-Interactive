# Performance Documentation

## Hard Performance Budgets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Projector update latency (p50) | < 200ms | Time from server broadcast to DOM update |
| Audience page interactive | < 1s (Wi-Fi), < 2s (4G) | Time to Interactive (TTI) |
| Lighthouse Performance | 90+ | Chrome DevTools audit |
| Lighthouse Accessibility | 95+ | Chrome DevTools audit |
| Bundle size (JS, gzipped) | < 150KB first load | Next.js bundle analyzer |
| API response time (p95) | < 500ms | App Insights |

## Real-time Payload Optimization

### Principle: Send Tallies, Not Raw Data
- Word cloud broadcasts: `{ words: [{text, count}], totalSubmissions }` (~1KB for 30 words)
- Poll broadcasts: `{ options: [{label, count, percent}], totalVotes }` (~200B for 5 options)
- Quiz broadcasts: `{ stats: {totalAnswered, percentCorrect}, leaderboard: [...top3] }` (~300B)

### Broadcast Throttling
- Server-side: tallies are recomputed and broadcast after each submission
- For high-throughput events (>100 submissions/sec), implement:
  - Batch aggregation: collect submissions for 100-200ms, then broadcast once
  - Delta updates: send only changed word counts
- Client-side: React state updates batched by React 18 automatic batching
- SignalR connection: single hub (`eventHub`) for all message types

### Payload Shape Examples

**Word Cloud (results_updated)**
```json
{
  "eventCode": "CSU2026",
  "questionId": "abc-123",
  "type": "wordcloud",
  "wordcloud": {
    "words": [
      {"text": "innovation", "count": 42},
      {"text": "teamwork", "count": 38},
      {"text": "cloud", "count": 25}
    ],
    "totalSubmissions": 150
  }
}
```

**Poll (results_updated)**
```json
{
  "eventCode": "CSU2026",
  "questionId": "def-456",
  "type": "poll",
  "poll": {
    "options": [
      {"label": "AI & ML", "count": 45, "percent": 30},
      {"label": "Security", "count": 60, "percent": 40},
      {"label": "DevEx", "count": 45, "percent": 30}
    ],
    "totalVotes": 150
  }
}
```

## Frontend Optimization

### Next.js Static Export
- `output: 'export'` generates static HTML/CSS/JS → served from CDN edge
- No server-side rendering overhead; all interactivity is client-side
- Images unoptimized (no Next.js Image Optimization server needed)

### Rendering Efficiency
- Display view uses `AnimatePresence` + `motion` for enter/exit only
- Word cloud positions are stable (no random reshuffles)
- Poll bars use CSS transitions via Framer Motion (GPU-accelerated)
- React state updates are batched (React 18)

### Bundle Splitting
- Next.js automatic code splitting per route
- Audience page (`/live/*`) doesn't load Display visualizations
- Fluent UI tree-shakes unused components

## Backend Optimization

### Cosmos DB
- Partition key: `eventCode` → all queries within a single partition (efficient)
- Autoscale: 4000 RU/s for events/questions, 10000 RU/s for responses
- Point reads for event/question lookups (by id + partition key)
- Cross-partition queries avoided by design

### Azure Functions
- Cold start mitigated by SWA Managed Functions (always warm after first request)
- Singleton Cosmos client (reused across invocations)
- No unnecessary middleware or heavy initialization

## Fallback Polling

When SignalR connection fails:
- Client detects `onclose` / `onreconnecting` event
- Automatically starts HTTP polling every 2 seconds
- Polls: `GET /api/events/{code}` (active question) + `GET /api/results/{code}/{qid}`
- When SignalR reconnects, polling stops automatically
- UI shows connection status badge (green=live, yellow=polling)

## Load Test Notes

### Expected Scale
- 500-2000 concurrent attendees
- Peak: ~500 submissions in 30 seconds (word cloud)
- SignalR Standard S1: supports 1000 concurrent connections

### Scaling Recommendations
| Attendees | SignalR SKU | Cosmos RU/s | Notes |
|-----------|-------------|-------------|-------|
| < 500 | Standard S1 (1 unit) | 4000/10000 autoscale | Default config |
| 500-2000 | Standard S1 (2 units) | 10000/20000 autoscale | Increase SignalR units |
| 2000-5000 | Standard S1 (5 units) | 20000/40000 autoscale | Consider broadcast batching |
| 5000+ | Premium P1 | 40000+ | Add Azure Front Door + aggressive caching |

### Testing Commands
```bash
# Basic load test with Azure Load Testing or k6
k6 run --vus 500 --duration 60s load-test.js
```

## Monitoring Alerts (Recommended)

| Alert | Condition | Action |
|-------|-----------|--------|
| API errors > 5% | App Insights failure rate | Check function logs |
| API latency p95 > 2s | App Insights response time | Scale Cosmos RU/s |
| SignalR connections > 80% capacity | SignalR metrics | Scale SignalR units |
| Cosmos 429 (throttled) > 0 | Cosmos metrics | Increase autoscale max |
