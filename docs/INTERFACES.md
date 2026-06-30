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
- `npm run generate:pet -- <source-image-path> <output-bundle-dir>` validates and decodes a local PNG/JPEG source image, runs the default scripted generation adapter, then writes a deterministic `pet bundle v0.1`.
- Cloud scaffold entrypoint: `npm run generate:pet:cloud -- <source-image-path> <output-bundle-dir> --provider mock-provider --confirm-cloud-upload`. This uses a mocked provider and does not perform live network calls.
- `npm run review:pet -- qa <bundle-dir> <review-dir>` validates a generated bundle and writes `review.json`, `preview.png`, and `contact-sheet.png` for user inspection.
- `npm run review:pet -- accept <bundle-dir> <library-dir>` validates and copies the bundle into `<library-dir>/<pet-id>` without adding files to the bundle.
- `npm run review:pet -- delete <target-dir> --root <allowed-root>` deletes an accepted or review directory only when the target is a child directory inside the allowed root.
- `npm run dev:app` launches the guided desktop manager UI for local or mock-cloud `generate -> QA -> accept/delete -> launch` flows.
- `npm run smoke:app` launches the guided UI in smoke mode and clicks through the mock-cloud flow with explicit upload confirmation, including runtime launch smoke.
- `npm run dev` launches the fixture in the Electron desktop runtime.
- `npm run smoke:runtime` runs Electron runtime negative cases, then launches both the fixture bundle and a generated bundle before exiting after structured renderer smoke results.

## Compatibility

- Every pet bundle must include a schema version.
- Runtime loaders should reject unsupported major versions with a clear error.
- `pet bundle v0.1` uses a strict file allowlist. Files not referenced by `pet.json` are rejected.
- `preview.png` and atlas assets must decode as PNGs and match declared dimensions.
- `pet bundle v0.1` requires `privacy.sourceImageStored` to be false; source images, source image paths, raw prompts, raw model responses, secrets, and other private payloads must not be present in the bundle.
- `source.meta.json` uses a strict v0.1 allowlist for non-sensitive provenance fields such as `fixture`, `generatedBy`, `generationAdapter`, `generationAdapterVersion`, `sourceType`, `inputMime`, `inputBytes`, `createdAt`, and `sourceImageStored:false`.
- Add migrations only after at least one real bundle format exists.
- Keep generated assets deterministic enough for regression tests where possible.

## Generation Adapter Contract

Generation adapters receive validated local source-image metadata and return generated pet assets. For `pet bundle v0.1`, adapter output is constrained to:

- `adapterId` and `adapterVersion`
- `petId` and `petName`
- eight transparent 256x256 PNG frames indexed `0..7`
- one transparent 256x256 `previewPng`
- no source image paths, prompts, raw model responses, tokens, secrets, or provider payloads

The bundle generator validates adapter output, packs frames into `atlases/main.png`, writes `preview.png`, and then validates the final bundle. Runtime consumes only the final bundle.

Real cloud adapters must fail with `CLOUD_OPT_IN_REQUIRED` unless the user explicitly confirms upload. Provider-specific failures map to project-owned codes such as `PROVIDER_NOT_CONFIGURED`, `MODEL_REFUSED`, `MODEL_RATE_LIMITED`, `MODEL_TIMEOUT`, `MODEL_PROVIDER_ERROR`, `MODEL_OUTPUT_INVALID`, and `POSTPROCESSING_FAILED`. The current scaffold supports only `mock-provider` and requires `DOUDOU_MOCK_CLOUD_API_KEY` to exercise provider-config gating without a live provider.

## Review Flow Contract

The review layer consumes only validated pet bundles. `qa` writes a separate `pet-review.v0.1` report and generated preview artifacts outside the bundle, so the bundle remains unchanged. `accept` installs a clean copy of the validated bundle into a local library directory. `delete` requires an explicit allowed root and refuses to delete that root itself or any target outside it.

## Guided App Contract

The guided app is a local Electron manager UI. It lets the user select a PNG/JPEG source image, choose local or `mock-provider` generation, explicitly confirm cloud upload for mock-cloud mode, create QA preview artifacts, accept the validated bundle into the local library, delete draft or accepted assets, and launch the accepted bundle in the desktop runtime. The UI does not add fields to `pet bundle v0.1` and does not pass source-image details to the runtime. Mock-cloud mode requires `DOUDOU_MOCK_CLOUD_API_KEY` in the app process environment and still performs no live network call.

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
