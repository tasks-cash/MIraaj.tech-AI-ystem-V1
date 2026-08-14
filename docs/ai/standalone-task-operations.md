# Miraaj standalone task operations

Miraaj owns campaign assignments, private proof evidence, recurring occurrences, and in-app notifications. Tasks.cash integration remains optional and disabled. No reward, wallet, payment, or withdrawal capability exists in this workflow.

## Browser proof upload

Enable both `CAMPAIGN_TASK_PARTICIPANT_PORTAL_ENABLED` and `CAMPAIGN_TASK_BROWSER_PROOF_UPLOAD_ENABLED` only after private S3-compatible storage and its browser CORS allowlist are configured. The web server authenticates participant API requests; browsers upload PNG, JPEG, or WebP bytes directly to a short-lived signed `PUT` URL. A submission is queued only after every current-revision object exists with the signed content type and exact byte length. Object keys and permanent evidence URLs are not returned.

## Recurring tasks

`CAMPAIGN_TASK_RECURRING_ENABLED` permits validated daily or weekly configuration. `CAMPAIGN_TASK_RECURRING_SCHEDULER_ENABLED` starts workers and requires MongoDB and Redis. Occurrences have deterministic recurrence keys and a tenant/task/key uniqueness barrier. Paused, cancelled, completed, archived, or emergency-stopped parents cannot activate occurrences.

## Notifications

In-app notifications are enabled with `NOTIFICATION_IN_APP_ENABLED=true`. Records are tenant/audience bound and deduplicated. Email and external webhooks are provider-neutral optional adapters and remain disabled by default. Tests use only deterministic fakes; notification bodies never persist evidence URLs.

## Operational rollout

1. Confirm MongoDB, Redis, API, AI service, and private MinIO health.
2. Configure the exact participant portal origin in MinIO CORS.
3. Enable the participant portal and browser upload for an internal tenant.
4. Enable recurring configuration, then its scheduler after queue observation is available.
5. Keep email, webhook, automatic verification, and Tasks.cash integration disabled for the internal pilot.
