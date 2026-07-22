# Distribution review, fraud limitations, and privacy

Reviewers receive short-lived private evidence previews, OCR/QR/marker summaries, deterministic comparisons, duplicate matches, risk indicators, reason codes and a reward recommendation. Decisions are `verified`, `rejected`, `request_more_evidence`, `fraudulent`, or `cancelled`.

Manipulation checks are bounded risk indicators, not forensic certainty. Normal platform similarity alone is not rejection evidence. Moderate/high risk, new layouts/locales, crops, login walls and private groups require review.

Proof objects are private. Submission records use a 90-day TTL by default; rejected evidence has a separately configurable shorter policy. Raw IP, precise location, passwords, cookies and biometric identifiers are not stored. Fraud retention must be explicitly restricted and legally reviewed before production use.
