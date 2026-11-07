# Zeus Watch

**Every cat seen. Every colony supported.**

A synthetic-data demonstration of colony census and volunteer care coordination, built for the Mangrove Mews hackathon scenario. The product connects evidence review, a dated census, urgent care needs and accountable action history. It is not a live rescue service or veterinary tool.

## Run locally

Requirements: Node.js 24+, npm, one writable local data directory.

```sh
npm run setup
npm run build
# Set a strong demo-only password in your shell or hosting secret manager.
# Do not put it in source control or reuse a real account password.
export DEMO_PASSWORD='replace-with-a-long-random-demo-value'
npm start
```

Open `http://localhost:3000`. Log in as `co1` or `co2` for coordinator review, `v01`/`v02` for assigned volunteers, or `v05` for an unassigned volunteer. A configured private demo password is required; there is no unauthenticated role switch. Use a separate browser session for concurrent-role tests. `admin` is an administrative-only demonstration identity, not an implicit care coordinator.

```sh
npm test
npm run build
```

## Demo safety

- All colony, cat and volunteer records are fictional, visibly labeled and separated into GOLDEN and SHOWCASE datasets.
- The four sample cat images are AI-generated. They are not source photography or a validated animal-identification benchmark.
- The extraction adapter is deterministic **MOCK_V1**, not a live model or WhatsApp integration.
- Exact original-photo GPS and current upload location are different kinds of evidence. GPS proximity never grants site access or proves a visit.
- A reported feeding visit does not complete a task. A submitted outcome is not confirmed until a distinct reviewer accepts it. An action completion does not resolve an issue automatically.
- Synthetic images may be shown as permitted demo derivatives. No actual Zeus photograph, real colony coordinates or private county geometry is included in this source tree.

## Replit and GitHub

See [Replit setup](docs/REPLIT.md), [architecture](docs/ARCHITECTURE.md), and [publication checklist](docs/PUBLICATION_CHECKLIST.md). Hosting and publication are not completed by this package. The proposed `.replit` config must be verified in the actual account and runtime. This single-process SQLite design must not be deployed as independent autoscaling replicas. Storage durability must be checked before relying on retained state.

No open-source license has been selected or applied on the owner's behalf in this development handoff. The event requires MIT or Apache 2.0 code licensing; apply the selected license before approved publication and consider media/data terms separately.

## What to present

Use the small GOLDEN fixture to prove correctness: import 15 events, review supported facts, retain two ambiguities, reject source instructions, and show six identities across two complete dated estimates. Reimport the exact fixture and show no duplicate records. Then demonstrate a claim and separate completion confirmation.

SHOWCASE is a separate richer visual dataset: 18 colonies, 108 fictional cats, 20 volunteers, visits, issues and actions. Do not use SHOWCASE counts to assert the GOLDEN tests passed.

## Known limitations and test evidence

Read `docs/VERIFICATION.md` before making claims about PRD conformance. Features not tested or not implemented must not be presented as verified. A real-data pilot requires a separate privacy, operational, retention and authorization review.
