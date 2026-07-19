
# Request signing

Sensitive private API calls require:

1. OAuth2 access token (`Authorization: Bearer …`)
2. Ed25519 request signature headers

Headers:

- `X-Maraaj-Key-Id`
- `X-Maraaj-Timestamp`
- `X-Maraaj-Nonce`
- `X-Maraaj-Content-SHA256`
- `X-Maraaj-Signature`
- `Idempotency-Key`

Canonical payload:

```
HTTP_METHOD\n
NORMALIZED_PATH\n
NORMALIZED_QUERY_STRING\n
BODY_SHA256\n
TIMESTAMP\n
NONCE\n
CLIENT_ID
```

Use `@maraaj/api-client` for Tasks.cash integrations.
