
# Threat model — Maraaj Intelligence Core

## 1. Stolen API credentials
- Asset: API client private key
- Actor: external attacker
- Path: leaked env / endpoint compromise
- Prevention: short-lived tokens, request signing, rotation, IP allowlists
- Detection: security events for revoked-key usage / anomalies
- Response: revoke key, rotate, invalidate jti
- Residual risk: offline key theft before detection

## 2. Request replay
- Prevention: nonce store in Redis + timestamp window (120s)
- Detection: `nonce_reused` security events

## 3. Token theft
- Prevention: 10-minute TTL, jti revocation, no localStorage for admin sessions
- Detection: unusual client usage patterns

## 4. Malicious uploads
- Prevention: MIME + magic bytes, size limits, ClamAV adapter, no SVG by default
- Detection: malware / rejected asset events

## 5. SSRF
- Prevention: DNS rebinding-aware destination checks, block private ranges, redirect limits
- Detection: destination unsafe failures

## 6. Cross-project access
- Prevention: scoped queries + token project binding
- Detection: `PROJECT_ACCESS_DENIED` audits

## 7. Privilege escalation
- Prevention: server-side RBAC on every mutation
- Detection: audit of role changes

## 8. Webhook abuse
- Prevention: signed deliveries, domain allowlists, SSRF checks
- Detection: delivery failures / suspicious webhooks

## 9. Provider-key leakage
- Prevention: envelope encryption; never return secrets
- Detection: audit of provider updates

## 10. Prompt injection via OCR
- Prevention: untrusted OCR channel; structured outputs; no tool execution from model text
- Detection: safety flags for injection patterns

## 11. Audit tampering
- Prevention: hash chain; integrity worker
- Detection: broken chain alert

## 12. Administrator compromise
- Prevention: Argon2id, TOTP, session revocation, recent-auth for dangerous actions
- Detection: login anomalies, security center
