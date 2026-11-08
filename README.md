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

Open `http://localhost:3000`. Log in as `co1` or `co2` for coordinator review, or `v01`/`v02`/`v05` for assigned volunteers. All existing showcase volunteers have a habitat assignment; do not assume `v05` is unassigned. Unassigned-access cases are tested only with isolated test fixtures. A configured private demo password is required; there is no unauthenticated role switch. Use a separate browser session for concurrent-role tests. `admin` is an administrative-only demonstration identity, not an implicit care coordinator.

```sh
npm test
npm run build
```

## Demo safety

- All colony, cat and volunteer records are fictional, visibly labeled and separated into GOLDEN and SHOWCASE datasets.
- The four bundled GOLDEN images and the separately approved 26-image showcase pack are AI-generated. They are not source photography or a validated animal-identification benchmark. Showcase photos use existing stable cat IDs, never similarity-based identity matching.
- The extraction adapter is deterministic **MOCK_V1**, not a live model or WhatsApp integration.
- Exact original-photo GPS and current upload location are different kinds of evidence. GPS proximity never grants site access or proves a visit.
- A reported feeding visit does not complete a task. A submitted outcome is not confirmed until a distinct reviewer accepts it. An action completion does not resolve an issue automatically.
- Synthetic images may be shown as permitted demo derivatives. The supplied Zeus illustrations are branding only, never census cats. No actual owner photograph, real colony coordinates or volunteer data is included.
- The approved county park boundaries and points retain their [source attribution and county disclaimer](fixtures/public-geography/README.md). All 18 habitat markers are explicitly fictional park references, not evidence of real colonies. OpenStreetMap attribution is retained.
- Support Our Cause is demonstration-only: no donations are processed and every payment option is disabled.

## Replit and GitHub

See [Replit setup](docs/REPLIT.md), [architecture](docs/ARCHITECTURE.md), and [publication checklist](docs/PUBLICATION_CHECKLIST.md). Repository contents do not establish a successful publish. The saved target is Reserved VM, with internal port 3000 mapped to external port 80. The build installs locked dependencies with development build tools explicitly included, even in production mode. This single-process SQLite design must not run as independent autoscaling replicas.

**Local SQLite and runtime uploads are not durable across replacement or republishing of a hosted instance.** Do not rely on this demo for retained operational data until a separately approved storage and backup design is in place. Do not publish or push merely because local tests pass.

Original code is covered by the existing [MIT license](LICENSE). That license does not replace the county disclaimer, OpenStreetMap terms, third-party dependency licenses or image provenance.

## Demo assets and repository boundary

The prepared source tree includes the Zeus brand illustrations, four GOLDEN images, approved park GeoJSONs, and all 26 individually approved showcase PNGs alongside their original manifests, prompts, hashes and stable-ID mappings. No general upload directory, original ZIP, live database or runtime media BLOB is included. See the [pack provenance](fixtures/synthetic/showcase/cat-image-pack/README.md) and [clean-clone reproduction instructions](docs/PUBLIC_SOURCE_REVIEW.md).

The app serves showcase JPEG derivatives from SQLite through authenticated, assignment-checked endpoints, not directly from the PNG source directory. A new clone needs a one-time import into its own new demo database. Package only the manifest-listed PNGs into an ignored temporary ZIP as described in the reproduction instructions, then use the existing owner-run command:

```sh
DATABASE_PATH=/path/to/new-local-demo.sqlite node scripts/upload-showcase-cat-images.mjs /path/to/temporary-approved-images.zip
```

It validates manifest hashes and refuses to overwrite different images. Use an explicitly selected local demo database; never point a rehearsal import at an operational database. The prepared public source tree excludes databases, sessions, runtime uploads, Secrets, populated environment files, logs, dependency directories, build caches, and agent asset metadata. `.env.example` contains only configuration names and non-secret examples, not account passwords. A clean snapshot does not sanitize earlier commits: review outgoing history separately before pushing.

## What to present

Use the small GOLDEN fixture to prove correctness: import 15 events, review supported facts, retain two ambiguities, reject source instructions, and show six identities across two complete dated estimates. Reimport the exact fixture and show no duplicate records. Then demonstrate a claim and separate completion confirmation.

SHOWCASE is a separate richer visual dataset: 18 colonies, 108 fictional cats, 20 volunteers, visits, issues and actions. Do not use SHOWCASE counts to assert the GOLDEN tests passed.

## Known limitations and test evidence

Read `docs/VERIFICATION.md` before making claims about PRD conformance. Features not tested or not implemented must not be presented as verified. A real-data pilot requires a separate privacy, operational, retention and authorization review.
