# PostgreSQL + PostGIS migration boundary

Kevin confirmed PostgreSQL + PostGIS as intended core infrastructure and held live Supabase/WhatsApp integration. This local demonstration uses SQLite only; it is not a substitute production architecture approval.

## Proposed migration

1. Replace the local store with normalized PostgreSQL tables for organizations, users, assignments, colonies, cats, memberships, observations, assertions, issues, actions, attempts, incoming updates, reviews, media, visits, audit and receipts.
2. Add organization scoping and same-organization foreign-key constraints to every relation. Add row-level policies and role-aware API projections. Validate them using denied-user tests; do not rely on client filtering.
3. Add unique constraints for source events and idempotency receipts. Use transactions and conditional updates for claims. Preserve the response receipt in the same transaction.
4. Store reference coordinates and evidence as PostGIS geography(Point,4326). Preserve evidence type, accuracy, capture time, receipt time and permission. ST_DWithin may shortlist candidates; verify distance algorithm and threshold semantics against the PRD Haversine oracle before changing results.
5. Persist private media in an authorized private object store; keep keys server-only and create expiring, role-scoped access. Public thumbnails must be separate approved derivatives.
6. Migrate synthetic fixtures first and rerun exact golden results, concurrent claims, cross-colony denial, stale versions, replay, EXIF/upload-location separation and partial outcome checks.
7. Only after explicit provider/account approval: configure database, identity, backups, lifecycle, quotas and deployment secrets. Run restore and migration rollback tests. Keep WhatsApp integration and live AI separately gated.

Do not combine SHOWCASE and GOLDEN. Do not migrate real rescue data, exact real colony locations or private county geometry merely because an application schema exists.

## Required production work beyond the demo

Approved identity provider, distinct credential issuance/revocation, encryption and key management, retention/deletion and backup policy, audit export protection, proxy-aware rate limits, multi-instance conflict tests, malware scanning, image-processing resource limits and operational incident response. Demo sessions and local storage are not a completed production security review.
