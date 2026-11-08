# Public source snapshot review

## Remote work preserved

The release branch starts directly from GitHub `main` at
`1cdb609f7fd5b710e2f6bcffda8ebb9208cc39e8`, not from the workspace's local-only
commit history. The following GitHub-only commits were reviewed:

- `dc8bdf8` — **Create .replit**: adds the build/start command, server entry
  point, Node 24 module, deployment build/run commands, and internal port
  3000 mapped to external port 80.
- `1cdb609` — **Create .gitignore**: excludes dependencies, frontend build
  output, populated environment files, databases, private review material,
  browser test output and logs; permits `.env.example`.

Every remote configuration value and ignore rule is retained. The current
workspace adds the Python module, Reserved VM target, production/HTTPS
settings, managed Run workflow and post-merge setup. The production build
explicitly installs locked development build tools. Ignore rules additionally
exclude workspace metadata, caches, attachments and generated artifacts.

No merge or automatic conflict resolution was performed. Existing local
history and the running workspace are preserved separately. This document
and a staged snapshot are not a commit or push receipt.

## Asset and license status

- **Original code:** existing `LICENSE` is MIT, unchanged.
- **Zeus branding:** the two supplied, owner-approved PNGs remain under
  `client/public/brand/`; Zeus is not a census animal.
- **GOLDEN images:** four existing fictional demo images remain unchanged.
- **Showcase:** 26 individually approved PNGs, 18 existing stable cat IDs,
  73,762,082 bytes total. Each matches its retained manifest SHA-256. The
  largest individual file is 3,320,240 bytes. No source image was modified,
  renamed to imply another identity, or derived from runtime uploads.
- **Image provenance:** original prompts, generation records, mapping,
  reference limitations and fictional-image notices remain. Owner approval
  permits inclusion for this public hackathon source; the code's MIT license
  does not independently establish third-party media rights.
- **County park geography:** only the two approved supplied park layers are
  included. Preserve `fixtures/public-geography/README.md`, its county
  attribution, terms link and disclaimer. No private colony geometry is added.
- **Basemap:** OpenStreetMap tiles are external, not bundled or relicensed.
  Visible attribution and applicable OSM copyright/tile-use terms remain.

All habitat markers, cats, care records and images remain fictional demo
content. No live database, private volunteer record, credential, populated
environment file, runtime upload folder or supplied ZIP is included.

## How the app serves showcase photos

The manifest maps each stable cat ID and view to a private route:

```text
/api/v1/cat-images/<stable-cat-id>/<front|side|rear>
```

`server/index.mjs` requires a session, a care-capable role and evidence
access to the cat's linked habitat. It also verifies the stored image's
stable ID, view, manifest hash and synthetic provenance. It reads a JPEG
derivative from SQLite `cat_media` and sends `Cache-Control: private, no-store`.
Missing or unauthorized evidence remains unavailable; original PNGs are not
served from a new public application route.

The current published app's login and anonymous image rejection were checked
without signing in. Anonymous checks cannot prove that all 26 private BLOBs
exist in the published database. No production credentials or database were
read. The reproducibility test below verifies all 26 against an isolated new
database instead; it is not a claim to have inspected production storage.

## Reproduce the private gallery in a fresh clone

Requirements: Node 24+, npm, Python 3 and the `unzip` command used by the
existing owner-run importer. Start from the repository root.

1. Install pinned dependencies and build:

   ```sh
   npm run setup
   npm run build
   ```

2. Package **only** the approved manifest entries into a temporary archive.
   This is generated output, ignored by Git, not a source asset:

   ```sh
   python3 - <<'PY'
   from pathlib import Path
   import hashlib, json, zipfile
   root = Path.cwd()
   pack = root / "fixtures/synthetic/showcase/cat-image-pack"
   entries = json.loads((pack / "manifest.json").read_text())
   target = root / "generated-artifacts/approved-showcase-images.zip"
   target.parent.mkdir(parents=True, exist_ok=True)
   with zipfile.ZipFile(target, "w", zipfile.ZIP_STORED) as archive:
       for entry in entries:
           source = pack / entry["file"]
           assert hashlib.sha256(source.read_bytes()).hexdigest() == entry["sha256"]
           archive.write(source, entry["file"])
   print("Packaged 26 manifest-verified fictional demo images.")
   PY
   ```

3. Select a **new** writable local database. Do not use an existing workspace
   or production database. The guard refuses to overwrite an existing path:

   ```sh
   QA_DB="$PWD/generated-artifacts/clean-clone-demo.sqlite"
   test ! -e "$QA_DB" || { echo "Choose a new local demo database path."; exit 1; }
   DATABASE_PATH="$QA_DB" node scripts/upload-showcase-cat-images.mjs \
     "$PWD/generated-artifacts/approved-showcase-images.zip"
   ```

   Expected first-import receipt: `26 added, 0 already present, 18 stable cat IDs`.
   No colony, cat or census records are created or changed by this importer.
   The app initializes its normal fictional showcase state when first started
   against this new database.

4. Configure demo credentials privately, following `REPLIT.md`; never put
   values into source or output. For a local HTTP rehearsal use development
   mode and non-secure local cookies only; preserve production/HTTPS settings
   for hosting. Start using the **same explicitly selected new database**:

   ```sh
   DATABASE_PATH="$QA_DB" npm start
   ```

   A permitted coordinator can view Callie and Sterling with their additional
   views. Assigned volunteers retain their existing habitat restrictions.
   Missing or uncertain identity matches remain unresolved.

5. Run `npm test`. `tests/showcase-pack.test.mjs` verifies source hashes,
   imports all 26 into its own temporary database, checks private delivery,
   rejects unrelated access and verifies exact replay without record changes.

SQLite BLOBs are runtime data, not source assets or durable hosting storage.
This procedure does not migrate production data, reset any database, or make
published filesystem persistence guarantees.
