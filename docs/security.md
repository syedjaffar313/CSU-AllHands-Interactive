# Security Documentation

## Threat Model (Lightweight)

### Assets
1. Event data (questions, responses, tallies)
2. Admin control panel access
3. Azure resource credentials

### Threat Actors
1. **Attendee (low risk):** Legitimate user who might spam or abuse
2. **External attacker (medium risk):** Attempts unauthorized access or DoS
3. **Insider (low risk):** Internal team member with elevated access

### Attack Vectors & Mitigations

| Threat | Vector | Mitigation |
|--------|--------|-----------|
| Spam/flood word cloud | Rapid repeated submissions | Rate limiting: 1 submission per 5s per device (slow mode) |
| Profanity/inappropriate content | Word cloud submissions | Profanity filter hook (stub; integrate Azure Content Safety) |
| Quiz cheating | Multiple answers per device | deviceId enforcement (localStorage + server-side dedup) |
| Admin panel hijack | Unauthenticated access to /control | Entra ID authentication required (SWA route rules) |
| XSS via user input | Malicious script in word/nickname | Input sanitization: strip HTML tags, limit charset, length caps |
| API abuse | Excessive API calls | Azure SWA built-in DDoS protection + rate limiting in Functions |
| Secret exposure | Secrets in code/logs | Key Vault, gitignored local settings, no PII in logs |
| CSRF | Cross-site request to API | SWA CORS configuration + SameSite cookies |
| Clickjacking | Embedding in iframe | X-Frame-Options: DENY header |

## Authentication & Authorization

### Entra ID (Admin)
- SWA built-in authentication with Azure Active Directory
- `/control/*` routes require `authenticated` role
- Session managed by SWA (secure, HttpOnly cookies)
- Hardened with: `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`

### Device Identification (Audience)
- Random UUID generated client-side, stored in localStorage
- Sent via `x-device-id` header and request body
- Not a security boundary; used for deduplication only
- Cannot be spoofed to gain elevated access

## Abuse Controls

### Rate Limiting
- Word cloud: 1 submission per `slowModeSeconds` (default 5s) per device
- In-memory rate limiter in Azure Functions (per instance)
- For production scale: consider Azure API Management or Redis-based rate limiting

### Input Validation
- All text inputs sanitized: HTML stripped, special chars removed, length capped
- Word cloud: max 25 characters, normalized (lowercase, trimmed)
- Nicknames: max 30 characters
- Event codes: 2-20 alphanumeric characters
- Option indices validated against question's option count

### Content Filtering
- Profanity filter hook implemented as `isProfane()` stub
- **Recommended:** Integrate [Azure AI Content Safety](https://azure.microsoft.com/services/ai-services/content-safety/) for production

## Secure Defaults

| Setting | Value | Notes |
|---------|-------|-------|
| SWA CORS | Configured per staticwebapp.config.json | No wildcard in production |
| Key Vault soft delete | Enabled (7 days) | Prevents accidental permanent deletion |
| Key Vault purge protection | Enabled | Cannot be disabled after creation |
| Storage Account HTTPS only | Enabled | TLS 1.2 minimum |
| SignalR CORS | Wildcard (for dev) | Restrict to SWA domain in production |
| Remote debugging | Not enabled | Do not enable in production |

## Security Headers (staticwebapp.config.json)
```json
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
}
```

## Incident Response
1. **Spam detected:** Close the active question from /control; delete abusive responses
2. **Unauthorized access attempt:** Check SWA auth logs in App Insights
3. **Secret compromise:** Rotate affected secret in Key Vault; update SWA App Settings
4. **DDoS:** Azure SWA + Front Door (if deployed) provide built-in DDoS protection
