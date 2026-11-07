# Zeus Watch architecture and scope mapping

## Implemented deployment shape

This demonstration uses a React + TypeScript client compiled by Vite and a Node.js 24 server. The server owns authentication, role projections, review decisions, idempotency and operational records. SQLite is a **documented local equivalent** to the PRD's Supabase/Postgres baseline, not a claim that Supabase has been configured. It requires one persistent server process and one local writable data volume. Do not run multiple replicas or treat ephemeral-host storage as durable.

No live OpenAI or WhatsApp connection is present. Suggestions are explicitly MOCK_V1. No source instruction can issue tools, fetch URLs or make canonical changes. Every material update requires a coordinator action.

The fixture data is fictional. It is not a real rescue record. Golden and showcase datasets are reset separately and must not be combined when checking acceptance counts. Computational location coordinates are not Miami locations.

## Public-copy boundaries

Only synthetic operational fixtures and generated sample images are included in this source tree. The owner's Zeus photograph is not included. The v1.1 county park geometry is not included because public redistribution terms have not been verified. No source emails, Library IDs, private Drive links or private research artifacts are required by this project. Public-source attribution may be linked in documentation; no third-party logos or photographs are incorporated.

## Hosting boundary

The application is a single-process prototype. Replit import is intended as a handoff, not completed hosting verification. A Replit operator must verify Node version, secrets, HTTPS cookie handling, access control, storage lifecycle and the same tests in the actual deployed environment before a public demo. A code repository license does not authorize a real-data pilot.
