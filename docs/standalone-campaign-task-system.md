# Standalone campaign task operations

Miraaj owns the non-financial campaign-task lifecycle. The operational layer links an approved campaign package, active distribution template and approved copy variants; it delegates QR, tracked-link, proof-marker, header, proof, review, private storage and outbox work to the existing distribution subsystem.

## Boundaries

- No reward amount, currency, wallet, balance, withdrawal, settlement or payment state exists.
- `externalRewardRuleReference` is optional opaque metadata and is never interpreted.
- `TASKS_CASH_INTEGRATION_ENABLED=false` remains the default. Standalone operations never call Tasks.cash.
- Participants are tenant-scoped opaque references. Miraaj does not require passwords, email, phone, bank or cryptocurrency data.
- Invitation secrets are returned once and only SHA-256 hashes are stored.
- Evidence remains in private object storage and is exposed only through short-lived signed URLs.

## Feature flags

The task domain is enabled independently from its exposure surfaces:

```dotenv
CAMPAIGN_TASK_OPERATIONS_ENABLED=true
CAMPAIGN_TASK_ADMIN_UI_ENABLED=true
CAMPAIGN_TASK_PARTICIPANT_PORTAL_ENABLED=false
CAMPAIGN_TASK_GENERAL_DISCOVERY_ENABLED=false
CAMPAIGN_TASK_INVITATIONS_ENABLED=false
CAMPAIGN_TASK_MANUAL_ASSIGNMENTS_ENABLED=false
CAMPAIGN_TASK_RECURRING_ENABLED=false
TASKS_CASH_INTEGRATION_ENABLED=false
```

General discovery, invitations, manual assignment, recurring availability, the participant portal and the future external integration must be deliberately enabled. Production readiness must fail if the existing distribution dependencies are unavailable.

## Data model

- `ai_campaign_tasks`: operational configuration, bounded lifecycle, revision history and authoritative capacity counters.
- `ai_distribution_participants`: tenant-scoped opaque participant profiles used for trusted eligibility.
- `ai_campaign_task_invitations`: hashed invitation tokens and immutable lifecycle timestamps.
- `ai_campaign_task_reservations`: idempotent claim reservations, expiration and assignment binding.
- `ai_campaign_task_events`: safe operational notifications without evidence URLs, secrets or financial data.

Assignments continue to use `ai_distribution_assignments`; copy, QR, headers, tracked links, proofs, verification attempts, human reviews and signed events remain in their existing collections.

## State and revision rules

The supported task lifecycle is:

```text
draft → awaiting_review → approved → scheduled|active
active ⇄ paused
active → capacity_reached|completed|cancelled
capacity_reached → completed|cancelled
completed|cancelled → archived
```

Archived tasks are terminal. Activation revalidates the linked campaign, template and copy. Every mutation uses `If-Match` with `currentRevision`; privileged transitions require a reason and produce an audit event.

## Eligibility and capacity

Eligibility uses only the stored participant profile and task configuration. Tenant, state, dates, emergency stop, country, language, locale, profession, industry, segment, private membership, pilot allowlist and capacity fail closed.

Claims require an idempotency key. The task counter is reserved with one conditional MongoDB update that checks `activeAssignmentCount < totalCapacity`; country counters use the same update. Reservations are persisted before distribution package creation. Failed package creation compensates the counter and remains observable for reconciliation. Duplicate idempotency keys return the existing assignment package.

The reconciliation endpoint expires stale reservations and invitations, then rebuilds active and per-country counters from assigned reservation rows.

## APIs

Administrator routes are under `/api/admin/ai/campaign-tasks`. They require the existing administrator authentication, narrow `aiCampaignTasks.*` permissions, `x-tenant-id`, strict schemas and revision checks.

Participant routes are under `/api/ai/distribution`. They require trusted authentication plus `x-tenant-id` and `x-participant-id`. Ownership is enforced for assignment packages, cancellation, upload sessions, proof completion and proof status.

The current v1 Tasks.cash contract remains unchanged and disabled. Stable task and participant public IDs allow a future authorized adapter to reference standalone tasks without migrating internal Mongo IDs.

## Web operations

Localized routes:

- `/{country}/{locale}/operations/campaign-tasks`
- `/{country}/{locale}/operations/campaign-tasks/{taskId}`
- `/{country}/{locale}/assignments/{assignmentId}`

The layouts inherit `dir` from the market configuration, so Arabic uses RTL while English and French use LTR. API tokens remain server-side. Advertising copy is rendered as text, never injected HTML.

## Internal pilot checklist

1. Keep participant and external delivery flags disabled while creating and approving task configuration.
2. Seed ten opaque dentist participant references for tenant `tenant_dz`.
3. Enable invitations and create the bounded invitation batch.
4. Confirm a non-invited participant receives the same not-found projection as a nonexistent private task.
5. Enable the participant portal only in the internal environment.
6. Claim concurrently and verify no more than ten assigned reservations.
7. Confirm every package has distinct tracked link, QR, header and marker.
8. Upload proof into private storage, complete it and confirm mandatory `needs_review`.
9. Review with a reason and revision check; verify one immutable non-financial outbox event.
10. Confirm no Tasks.cash network call and no financial field in task, proof, review or event documents.
