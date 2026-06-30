<!-- codex-project-bootstrap:generated -->
# Interfaces


## Public Contracts

The first durable contract should be the pet bundle. Generation produces it; preview and desktop runtime consume it.

Initial bundle shape:

- `pet.json`: manifest with schema version, pet identity, asset paths, frame metadata, behavior tags, and permissions.
- `atlases/main.png`: fixed-grid transparent PNG sprite atlas.
- `preview.png`: compact preview used by the UI.
- `source.meta.json`: non-sensitive provenance metadata, excluding secrets and raw prompts unless explicitly safe.

Potential developer interfaces:

- `npm run validate:fixture` validates the committed fixture bundle.
- `node dist/src/cli/validate-pet.js <bundle-dir>` validates any local bundle after `npm run build:main`.
- `npm run generate:pet -- <source-image-path> <output-bundle-dir>` validates and decodes a local PNG/JPEG source image, then writes a deterministic placeholder `pet bundle v0.1`.
- `npm run dev` launches the fixture in the Electron desktop runtime.
- `npm run smoke:runtime` runs Electron runtime negative cases, then launches both the fixture bundle and a generated bundle before exiting after structured renderer smoke results.

## Compatibility

- Every pet bundle must include a schema version.
- Runtime loaders should reject unsupported major versions with a clear error.
- `pet bundle v0.1` uses a strict file allowlist. Files not referenced by `pet.json` are rejected.
- `preview.png` and atlas assets must decode as PNGs and match declared dimensions.
- `pet bundle v0.1` requires `privacy.sourceImageStored` to be false; source images, source image paths, raw prompts, raw model responses, secrets, and other private payloads must not be present in the bundle.
- `source.meta.json` uses a strict v0.1 allowlist for non-sensitive provenance fields such as `fixture`, `generatedBy`, `sourceType`, `inputMime`, `inputBytes`, `createdAt`, and `sourceImageStored:false`.
- Add migrations only after at least one real bundle format exists.
- Keep generated assets deterministic enough for regression tests where possible.

## Examples

```json
{
  "schemaVersion": "0.1.0",
  "id": "valid_minimal_atlas_pet",
  "name": "Valid Minimal Atlas Pet",
  "assetFormat": "png_sprite_atlas_grid",
  "canvas": {
    "width": 256,
    "height": 256,
    "anchor": { "x": 128, "y": 232 }
  },
  "assets": {
    "preview": "preview.png",
    "atlases": [
      {
        "id": "main",
        "path": "atlases/main.png",
        "mime": "image/png",
        "width": 1024,
        "height": 512,
        "frameWidth": 256,
        "frameHeight": 256,
        "columns": 4,
        "rows": 2
      }
    ]
  },
  "animations": {
    "idle": {
      "atlas": "main",
      "loop": true,
      "frames": [
        { "index": 0, "durationMs": 140 },
        { "index": 1, "durationMs": 140 },
        { "index": 2, "durationMs": 140 },
        { "index": 1, "durationMs": 140 }
      ]
    },
    "tap_react": {
      "atlas": "main",
      "loop": false,
      "frames": [
        { "index": 4, "durationMs": 90 },
        { "index": 5, "durationMs": 120 },
        { "index": 6, "durationMs": 120 }
      ],
      "next": "idle"
    }
  },
  "behavior": {
    "initial": "idle",
    "onTap": "tap_react"
  },
  "hitArea": {
    "type": "alpha",
    "alphaThreshold": 16,
    "fallbackRect": { "x": 48, "y": 32, "width": 160, "height": 208 }
  },
  "privacy": {
    "sourceImageStored": false,
    "cloudGenerated": false
  },
  "provenance": {
    "sourceMeta": "source.meta.json"
  }
}
```
