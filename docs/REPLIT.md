# Replit setup and reveal checklist

1. Import the approved source repository or source ZIP into a Node project. This package does not create accounts, publish code or deploy on your behalf.
2. Confirm `node --version` is 24 or later. The server uses Node's built-in SQLite module. `.replit` is a proposed configuration; verify the runtime module available in the selected Replit environment.
3. Set `NODE_ENV=production` and `DEMO_PASSWORDS_JSON` in Replit Secrets: a JSON object mapping each enabled lowercase username to its own distinct strong password (at least 12 characters). Do not use actual personal passwords, commit values or paste them into a public README. Set `COOKIE_SECURE=1` for HTTPS hosting, `PORT=3000`, and `HOST=0.0.0.0`. The shared `DEMO_PASSWORD` fallback is for local rehearsal only and is rejected in production.
4. Run `npm run setup`, `npm run build`, `npm test`, then `npm start`.
5. Confirm the external URL shows login and that `/api/v1/dashboard` without a session is denied. Log in as `co1` using that account’s private password. Use `co2` for separate review confirmation, and `v01`, `v02`, `v05` to exercise volunteer and unassigned access. These are demo accounts, not real volunteers.
6. Use only one deployment instance. Confirm how Replit retains local SQLite data during restart/redeploy. If storage is ephemeral, describe it as a resettable demo and do not rely on it for operational records. Do not deploy on autoscaling replicas with independent SQLite files.
7. Rehearse the golden import, approved reviews, replay, claim conflict and separate completion review. Keep a local copy for fallback.
8. Verify repository visibility, license and organizer submission requirements separately. No third-party county geometry or real cat/volunteer records belong in the public repository.

## Reveal boundaries

- Say "synthetic-data demonstration, deterministic suggestions" rather than imply live AI, WhatsApp integration or operational rescue use.
- The app's labels and permissions do not establish veterinary validity, site-access permission, or a production privacy assessment.
- Production requires external identity management, approved data retention and deletion, managed backups/restore, access revocation, monitoring and validated privacy controls.

## Rollback

Stop the deployment or remove public access. Preserve any test evidence needed for diagnosis before resetting the synthetic dataset. Never restore a production database from this demo.
