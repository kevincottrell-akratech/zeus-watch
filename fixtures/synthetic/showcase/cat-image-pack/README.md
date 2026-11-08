# Zeus Watch synthetic cat image pack v1

## Current application and distribution status

The original generation notes below are retained as provenance, not as a current implementation claim. The current app links this manifest to the 18 existing stable showcase cat IDs, renders primary/additional views and preserves fictional-image notices. It does not infer matches from image similarity or change the census.

The prepared Git tree contains the manifests, mapping, generation records and **the 26 individually approved original PNGs** under `images/`. Every PNG is byte-for-byte identical to its manifest SHA-256. It does not contain the supplied ZIP, historical `selected.json`, or gallery HTML. Runtime SQLite media tables and the general upload directory must never be published as source assets.

Only the explicit manifest-listed image entries were extracted from the supplied archive; no other upload was copied. The largest individual PNG is 3,320,240 bytes. No large binary pack is added to Git history. See `docs/PUBLIC_SOURCE_REVIEW.md` for the temporary, ignored ZIP and new-database import needed to reproduce the private gallery. Preserve the fictional-image notice and existing access rules.

## Original generation notes

Created November 7, 2026. **All 26 images are AI-generated. None depicts a verified real rescue animal, colony, person, or location.**

## Contents
- Four multiview cats (K001–K004): front, side and rear three-quarter views, 12 images
- Fourteen additional cats: one image each
- 18 distinct stable showcase cat IDs total, across 15 fictional colonies
- `manifest.json`: full prompts, reference associations, hashes, dimensions, provenance, IDs and accessibility text
- `cat_photo_mapping.csv`: proposed asset-to-existing-cat mapping
- `selected.json`: original synthetic record snapshot; no existing app records were changed
- `gallery.html`: local review gallery; open alongside the images folder

## Integration boundary
This is a separate asset proposal for the next build revision. It is **not integrated** into Zeus Watch v0.1. Use exact `cat_id` to map images; do not infer identity from filenames or create additional cats. Do not modify the GOLDEN acceptance fixture. Retain UI text “AI-generated demo image” next to photos and a persistent synthetic-data banner. Existing sterilization, age and other statuses are fictional fixtures, not conclusions supported by these images.

## Quality and limitations
The eight additional multiview images used their front portrait as a reference. Visual review confirms consistent broad appearance, but small fur-pattern details can vary and unseen sides are generated, not reconstructed. These are illustrative views, **not biometric identity ground truth, validated recognition tests or a full 360-degree model**. Use human confirmation for identity matching; no automatic merges. Some “ear partly obscured” images portray a turned/folded ear rather than reliable occlusion: never derive sterilization or health status from those images.

The 26 PNGs were decoded and individually reviewed. Each maps to an existing showcase ID. All have 1254 × 1254 pixels. No EXIF GPS was present. No location was embedded or inferred. Preserve generated-image provenance metadata. No real photos, third-party logos or private geography are included.

Generated with the built-in OpenAI image-generation tool; exact backing model/version is not exposed. `generation_records.json` and `manifest.json` retain the prompts. Names and mappings do not imply real cats. AI-generated content may resemble existing animals; no exclusivity claim is made.
