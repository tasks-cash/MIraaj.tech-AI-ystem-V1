# Campaign operations and non-financial pilot

Miraaj campaign operations extend approved Prompt 4 campaign packages. They do
not create a second campaign engine. An administrator imports an approved
package, records operational revisions, approves it, and may pause, resume, or
archive it. Distribution templates have a bounded lifecycle from draft through
review, approval, scheduling, activation, pause, completion, and archive.
Archived templates cannot be reactivated.

Only approved campaign content and approved copy variants may be assigned.
Assignment creation remains idempotent and binds the external task, external
user, template revision, copy revision, tracked link, QR, proof marker, and
private header asset. Pilot allowlists and capacity limits are enforced from
server configuration. The emergency assignment, proof-processing, and outbox
stops fail closed.

Proof screenshots use private object storage and short-lived signed URLs.
Additional evidence creates a new immutable evidence revision; prior attempts
remain represented in metadata. Human review requires a reason and supports
verified, rejected, more-evidence, duplicate, fraudulent, and cancelled
decisions. Differentiated retention applies to accepted, rejected, duplicate,
and fraud-review evidence. Cleanup skips active review and legal/retention
holds, deletes private objects idempotently, and preserves minimized decision
history.

Operational metrics contain campaign/distribution/proof/queue/outbox state only.
They do not contain rewards, balances, wallets, withdrawals, or settlement
instructions. Tasks.cash callbacks, automatic verification, public-post
inspection, and the pilot are disabled by default.

## Pilot activation checklist

1. Approve the Prompt 4 campaign revision and distribution copy.
2. Configure the exact campaign, country, language, platform, and domain
   allowlists.
3. Set bounded pilot assignment limits and keep mandatory human review enabled.
4. Verify MongoDB, Redis, MinIO privacy, proof queues, review permissions, and
   outbox state.
5. Keep Tasks.cash integration disabled until the external contract owner
   approves callback activation.
6. Exercise the Arabic Algeria dentist fixture locally. Do not use real group
   screenshots, paid providers, social credentials, or production user data.
