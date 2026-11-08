# Replit setup and reveal checklist

1. Import the approved source repository or source ZIP into a Node project. This package does not create accounts, publish code or deploy on your behalf.
2. Confirm `node --version` is 24 or later. The server uses Node's built-in SQLite module. `.replit` specifies Reserved VM, `0.0.0.0` binding and internal port 3000 mapped to external port 80; the server honors an assigned `PORT`.
3. Keep `NODE_ENV=production` and `COOKIE_SECURE=1` for HTTPS hosting. Store credentials only in Replit Secrets. Production supports the existing per-account `DEMO_PASSWORDS_JSON` mapping and/or distinct coordinator and volunteer role-password Secrets named `DEMO_COORDINATOR_PASSWORD` and `DEMO_VOLUNTEER_PASSWORD`. Role passwords cover their existing role only; the administrator remains separate and does not become a care coordinator. Do not put values in source, logs, screenshots or the login screen. The `DEMO_PASSWORD` fallback is for local rehearsal only and is rejected in production.
4. Run `npm run setup`, `npm run build`, `npm test`, then `npm start`. Setup uses `npm ci --include=dev` for both packages: TypeScript and Vite are build-time requirements even when `NODE_ENV=production`. Do not disable production security or upgrade dependencies to work around a missing compiler. A publish starts a separate build; a passing local build is not a production success receipt.
5. Confirm the external URL shows login and that `/api/v1/dashboard` without a session is denied. Log in as `co1` using that account’s private password. Use `co2` for separate review confirmation, and `v01`, `v02`, `v05` to exercise assigned-volunteer access and denial outside each assignment. All existing showcase volunteers have an assignment; unassigned cases belong in isolated test fixtures, not by changing these accounts. These are demo accounts, not real volunteers.
6. Use only one deployment instance. Published local filesystem data is not durable across instance replacement or republishing. This includes the SQLite database and image BLOBs. Describe it as a fictional demonstration and do not rely on it for retained operational records. Do not deploy on autoscaling replicas with independent SQLite files. Any durable database/storage migration requires separate approval; never reset existing data to test publishing.
7. Rehearse the golden import, approved reviews, replay, claim conflict and separate completion review. Keep a local copy for fallback.
8. Verify repository visibility, the existing MIT license and organizer submission requirements separately. Only the owner's approved county park layers may be included, with their attribution/disclaimer and fictional marker notices. No private colony geography, real cat/volunteer records, live databases or user uploads belong in the public repository. The 26 approved showcase PNGs are individually bundled and hash-checked against the original manifest. Follow `docs/PUBLIC_SOURCE_REVIEW.md` to reproduce their private JPEG delivery in a new local demo database; do not copy a live database.

## Reveal boundaries

- Say "synthetic-data demonstration, deterministic suggestions" rather than imply live AI, WhatsApp integration or operational rescue use.
- The app's labels and permissions do not establish veterinary validity, site-access permission, or a production privacy assessment.
- Production requires external identity management, approved data retention and deletion, managed backups/restore, access revocation, monitoring and validated privacy controls.

## Rollback

Stop the deployment or remove public access. Preserve any test evidence needed for diagnosis before resetting the synthetic dataset. Never restore a production database from this demo.
