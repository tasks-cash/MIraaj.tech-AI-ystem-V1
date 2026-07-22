# QR and tracked-link security

QR codes are generated and decoded locally with OpenCV. The final composed header is decoded again before persistence. QR payloads contain only a cryptographically random tracked URL—never a user ID or MongoDB ID.

`GET /r/:opaqueToken` is intentionally public. Only the SHA-256 token hash is used for lookup. Targets must be HTTPS and exactly match the configured hostname allowlist. Links expire and can be revoked. Counters do not retain raw IP addresses or geolocation, and clicks are supporting evidence only.
