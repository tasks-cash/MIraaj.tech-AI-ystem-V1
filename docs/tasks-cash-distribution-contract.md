# Tasks.cash distribution contract

The protected `/api/integrations/tasks-cash/distribution` API uses timestamped HMAC requests, nonce replay prevention, idempotency keys, external IDs and correlation IDs. Integration is disabled until a callback URL and 32-character secret are configured.

Final decisions create persistent `proof.verification.completed` outbox events. Delivery signs the body, retries with exponential backoff, recovers stale work and retains terminal failures. Tasks.cash is the final reward authority. Miraaj.tech emits only `eligible`, `not_eligible`, `pending_review`, `expired`, `duplicate`, or `fraud_suspected`; it never credits balances, settles rewards, approves withdrawals, or transfers cryptocurrency.
