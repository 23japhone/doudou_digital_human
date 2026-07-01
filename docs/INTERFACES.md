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
- `npm run generate:pet -- <source-image-path> <output-bundle-dir>` validates and decodes a local PNG/JPEG source image, runs the default deterministic stylized PNG adapter, then writes a deterministic `pet bundle v0.1`.
- `npm run qa:stylizer -- <output-dir>` creates a rights-safe synthetic visual QA corpus for the deterministic local adapter. It writes synthetic source images, one valid bundle per corpus case and tuning preset, copied previews/atlases, `contact-sheet.png`, `stylizer-qa-report.json`, `manual-scoring-checklist.md`, and `manual-scoring-template.json`.
- `npm run qa:stylizer:compare -- <source-image-path> <output-dir>` validates a local PNG/JPEG source image and writes side-by-side local stylizer previews for `balanced`, `soft_mask`, and current default `bold_edges`. It writes `previews/*.png`, `contact-sheet.png`, and `stylizer-preview-comparison-report.json` only; it does not write a pet bundle, source image copy, source path, prompt, or raw provider payload.
- `npm run qa:stylizer:check -- <manual-scoring-template.json> <candidate-preset>` checks completed manual scoring evidence for a proposed default stylizer preset. It exits `0` with pass JSON when the candidate is approved and meets score thresholds, exits `1` with stable failure JSON when evidence is incomplete or invalid, and exits `2` for CLI usage errors. The command is safe for PR bots or pre-commit hooks because it does not print the scoring file path or scoring content.
- `npm run qa:stylizer:default-gate -- [--changed-file <path>...] [--staged] [--base <ref> [--head <ref>]] [manual-scoring-template.json candidate-preset]` is the change-aware forced check wrapper. It exits `0` without scoring evidence when default stylizer parameter files are unchanged. When `src/generation/adapters/deterministic-stylized-png-adapter.ts` changes, it requires a scoring JSON path plus candidate preset and delegates to `qa:stylizer:check`. Standard checks run this through `npm run lint`; hooks or CI can provide evidence either as positional args or as `STYLIZER_SCORING_FILE` and `STYLIZER_CANDIDATE_PRESET`.
- Cloud scaffold entrypoint: `npm run generate:pet:cloud -- <source-image-path> <output-bundle-dir> --provider mock-provider --confirm-cloud-upload`. This uses a mocked provider and does not perform live network calls.
- `npm run review:pet -- qa <bundle-dir> <review-dir>` validates a generated bundle and writes `review.json`, `preview.png`, and `contact-sheet.png` for user inspection.
- `npm run review:pet -- accept <bundle-dir> <library-dir>` validates and copies the bundle into `<library-dir>/<pet-id>` without adding files to the bundle.
- `npm run review:pet -- delete <target-dir> --root <allowed-root>` deletes an accepted or review directory only when the target is a child directory inside the allowed root.
- `npm run dev:app` launches the guided desktop manager UI for local stylizer comparison preview plus local or mock-cloud `generate -> QA -> accept/delete -> launch/stop` flows. See [Guided App Quickstart](GUIDED_APP_QUICKSTART.md) for the shortest manual path and smoke checklist.
- `npm run smoke:app` launches the guided UI in smoke mode and clicks through the mock-cloud flow with explicit upload confirmation, including local stylizer developer preview and runtime launch smoke.
- `npm run qa:app:visual` launches the guided UI in visual QA mode at the minimum supported window size, injects representative Chinese source filename, status/error, provider, action, style-title, and QA text, writes a local screenshot under `output/playwright/`, and fails on detected text overflow or overlapping controls.
- `npm run smoke:app:live` launches the same guided UI smoke against `openai_live` only when `DOUDOU_ENABLE_OPENAI_LIVE=1` and `OPENAI_API_KEY` are set; otherwise it prints a skipped result and exits 0. Pass `-- --source <image-path>` or set `DOUDOU_APP_SMOKE_SOURCE_IMAGE=<image-path>` to use a specific local source image for the smoke. Explicit source-image smoke also requires `DOUDOU_CONFIRM_SOURCE_UPLOAD=1`.
- `npm run dev` launches the fixture directly in the Electron desktop runtime. This is the lower-level runtime entrypoint; use `Ctrl+C` in the terminal to stop it during development.
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

Generation adapters receive validated local source-image metadata and return generated pet assets. Adapters that need pixels receive a normalized temporary 256x256 PNG owned by generation code; they must not receive or return source image paths. For `pet bundle v0.1`, adapter output is constrained to:

- `adapterId` and `adapterVersion`
- `petId` and `petName`
- eight transparent 256x256 PNG frames indexed `0..7`
- one transparent 256x256 `previewPng`
- no source image paths, prompts, raw model responses, tokens, secrets, or provider payloads

The default local adapter is `deterministic-stylized-png-adapter@0.1.0`. It is non-model and local-only: it posterizes normalized source pixels, adds deterministic edge/outline styling, and emits the same eight-frame contract as cloud or scripted adapters. Its default parameters now use the QA-approved `bold_edges` preset for stronger small-size readability. The adapter accepts optional tuning parameters grouped under `crop`, `mask`, `color`, and `edge`; those parameters are generation-only and are not written into `pet bundle v0.1`. The bundle generator validates adapter output, packs frames into `atlases/main.png`, writes `preview.png`, and then validates the final bundle. Runtime consumes only the final bundle.

## Stylizer QA Corpus

`npm run qa:stylizer -- <output-dir>` is a developer QA interface, not part of the runtime. It uses only project-owned synthetic geometric source images and runs the default local stylizer across preset parameter sets:

- `balanced`
- `soft_mask`
- `bold_edges`

`balanced` is retained as the legacy baseline, while `bold_edges` is the current default. The output report uses relative paths only and records non-sensitive metrics such as visible bounds and non-transparent pixel counts. The manual scoring template covers crop fit, mask silhouette, color preservation, edge clarity, and pet cuteness. A default stylizer parameter change must have completed scoring evidence for the candidate preset, explicit approval, and passing threshold scores before the default constants are changed. `npm run qa:stylizer:check -- <manual-scoring-template.json> <candidate-preset>` owns the scoring rules. `npm run qa:stylizer:default-gate -- ...` owns change detection and is the repository-level automation boundary for PR bots or pre-commit hooks. Generated QA outputs are local artifacts for inspection and should not include personal source images, secrets, prompts, or raw provider responses.

`npm run qa:stylizer:compare -- <source-image-path> <output-dir>` is the local-image manual comparison interface. It uses the same local intake and normalization path as generation, then deletes temporary normalized files after writing derived previews and a relative-path report. The guided manager exposes the same operation through its Style Compare developer preview entry, but still treats the output as local derived QA artifacts, not as a pet bundle or runtime input.

Real cloud adapters must fail with `CLOUD_OPT_IN_REQUIRED` unless the user explicitly confirms upload. Provider-specific failures map to project-owned codes such as `PROVIDER_NOT_CONFIGURED`, `MODEL_REFUSED`, `MODEL_RATE_LIMITED`, `MODEL_TIMEOUT`, `MODEL_PROVIDER_ERROR`, `MODEL_OUTPUT_INVALID`, and `POSTPROCESSING_FAILED`. The guided app supports `mock-provider` with `DOUDOU_MOCK_CLOUD_API_KEY` and `openai-image` with `DOUDOU_ENABLE_OPENAI_LIVE=1` plus `OPENAI_API_KEY`. `openai-image` uses an OpenAI-compatible image edits endpoint with a normalized PNG input and expects a base64 PNG image response. Configure it with either `DOUDOU_OPENAI_IMAGE_ENDPOINT` or `DOUDOU_OPENAI_BASE_URL` / `OPENAI_BASE_URL`; configure the model with `DOUDOU_OPENAI_IMAGE_MODEL` or `OPENAI_MODEL`. Text-only chat/completions models are not sufficient for this adapter. Raw provider responses, prompts, source paths, and secrets must not be returned from the adapter or written into the bundle.

## Review Flow Contract

The review layer consumes only validated pet bundles. `qa` writes a separate `pet-review.v0.1` report and generated preview artifacts outside the bundle, so the bundle remains unchanged. `accept` installs a clean copy of the validated bundle into a local library directory. `delete` requires an explicit allowed root and refuses to delete that root itself or any target outside it.

## Guided App Contract

The guided app is a local Electron manager UI. It lets the user select a PNG/JPEG source image, create a local Style Compare developer preview from derived stylizer previews/contact sheet, choose local, `mock-provider`, or `openai-image` generation, explicitly confirm cloud upload for each cloud generation attempt, create QA preview artifacts, accept the validated bundle into the local library, delete draft or accepted assets, launch the accepted bundle in the desktop runtime, and stop the runtime process it launched. Deleting draft or accepted assets clears the app's current source-image selection metadata, including the displayed filename, but does not delete the user's original local image file. The UI does not add fields to `pet bundle v0.1` and does not pass source-image details to the runtime. Runtime stop is app workflow state only: the manager keeps the child-process handle, sends termination to that managed process, also stops it during app quit, and keeps the runtime/bundle contract unchanged. Mock-cloud mode requires `DOUDOU_MOCK_CLOUD_API_KEY` in the app process environment and still performs no live network call. OpenAI live mode requires `DOUDOU_ENABLE_OPENAI_LIVE=1`, `OPENAI_API_KEY`, and the UI confirmation checkbox.

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
