# Miraaj.tech ↔ Tasks.cash distribution contract v1

The source of truth is `distribution.contracts.ts`. These immutable JSON fixtures support cross-repository compatibility tests without coupling either repository to the other's package graph.

- API version: `v1` (required in request bodies or `x-miraaj-api-version` for identity-bound reads).
- Event type/version: `proof.verification.completed`, version `1`.
- Request timestamp: Unix epoch milliseconds; allowed skew is 120 seconds.
- Request signature headers: `x-tasks-cash-timestamp`, `x-tasks-cash-nonce`, `x-tasks-cash-signature`.
- Request canonical form: `METHOD\nPATH\nTIMESTAMP\nNONCE\nSHA256(JSON.stringify(body || {}))`.
- Callback headers: `x-miraaj-event-id`, `x-miraaj-timestamp`, `x-miraaj-signature`.
- Callback canonical form: `TIMESTAMP.raw-json-body`.
- Result checksum: SHA-256 of canonical UTF-8 JSON `{decision,reasons,scores}`, with recursively sorted object keys and sorted unique reason codes; array order is otherwise preserved. For the callback projection, `scores` is exactly `{overallVerificationScore: verificationConfidence}`, so Tasks.cash can independently verify the signed event without private analysis fields.
- Idempotency: mutation requests require `idempotency-key`; nonce replay is rejected through Redis NX and durable Mongo uniqueness.
- Identity-bound reads additionally require `x-tasks-cash-external-user-id`.
