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
- `npm run dev` launches the fixture directly in the Electron desktop runtime. This is the lower-level runtime entrypoint; use `Ctrl+C` in the terminal to stop it during development. Add `DOUDOU_RUNTIME_TUNING=1` to show the developer-only motion tuning panel, or launch the runtime entrypoint with `--tuning`. Add `DOUDOU_EMOTION_TRIGGER_PANEL=1` or launch with `--emotion-panel` to show the developer-only 兜兜 emotion trigger panel: the renderer accepts one text input plus a per-click authorization checkbox, main performs the configured emotion-model call only after that explicit click and consent, and the panel displays only sanitized call/command/apply status. Optional launch presets are `DOUDOU_RUNTIME_RETREAT_DISTANCE`, `DOUDOU_RUNTIME_WATCH_MS`, and `DOUDOU_RUNTIME_RECOVERY_SPEED`. The motion tuning panel can copy the current settings as a one-line `DOUDOU_RUNTIME_TUNING=1 ... npm run dev` preset command, or save named local presets in the runtime user-data directory so different characters can keep separate rhythms. The current tuned defaults are 216px retreat distance, 680ms watch pause, and 280px/s recovery speed.
- `npm run smoke:runtime` runs Electron runtime negative cases, then launches both the fixture bundle and a generated bundle before exiting after structured renderer smoke results, including primary-button drag window motion, proof that passive cursor contact did not move the overlay window, alpha-gated cursor-follow hit testing, observed runtime states, default 兜兜 emotion ids and scenarios, emotion motion phases, motion tuning panel evidence, emotion trigger panel evidence proving an unconsented button click does not call the provider and renders sanitized status, motion direction, stop rebound, tap expression frames, runtime emotion-memory wariness from repeated alpha pokes, visual state class evidence, and the flag-gated Web Cubism renderer spike evidence for expression creation, expression switching, `updateMotion`, model update, draw calls, optional local official SDK/model resolver status, and optional external official runtime module host evidence. When an official runtime module is loaded, the smoke requires the shared official evidence gate: fetched `model3.json`, loaded runtime module, loaded model, 12 expressions, multiple non-idle official expression emotions observed through desktop switches, no pending official expression switches, a non-idle active emotion, that switched expression applied after a successful frame, that the switched expression changed rendered Live2D canvas pixels, internal runtime lifecycle evidence for loading 12 expressions, setting at least two expressions, `updateMotion`, model update, and draw, visible Live2D canvas layer with nontransparent rendered pixels in the desktop window, advanced frame loop, and at least two host update/draw calls.
- `DOUDOU_EMOTION_PANEL_SMOKE_CONSENT=1 npm run smoke:runtime` is the explicit live acceptance path for the 兜兜 emotion trigger panel. It requires the local `DOUDOU_EMOTION_MODEL_ENDPOINT`, `DOUDOU_EMOTION_MODEL_API_KEY`, and `DOUDOU_EMOTION_MODEL_ID` configuration, clicks the panel with consent enabled against the fixture bundle, requires provider-called plus command-applied evidence, and still emits only sanitized panel status.
- `src/runtime/default-doudou-live2d.ts` is the Stage B research contract for default 兜兜 Live2D and model arbitration. It maps the 12 default emotion ids to Cubism-style `.exp3.json` expression specs, validates parameter IDs/ranges/blend modes, and exposes an LLM/VLM output schema where models may suggest only safe intent plus an allowlisted emotion id.
- `npm run export:doudou-live2d -- <output-dir>` builds the Stage C CLI and writes the 12 default 兜兜 Live2D expressions to `<output-dir>/expressions/doudou_<emotion_id>.exp3.json` using real Cubism `.exp3.json` fields only.
- `npm run validate:doudou-live2d -- <output-dir>` rebuilds the same CLI and validates that a default 兜兜 Live2D expression directory matches `DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS`. Success and failure output are stable JSON and use only relative expression file paths.
- `fixtures/live2d/default_doudou_expressions/` is the committed Stage C fixture snapshot for the default 兜兜 `.exp3.json` expressions. It is research/runtime fixture data only and is not part of `pet bundle v0.1`.
- `npm run preview:doudou-live2d -- <expressions-dir> <from-emotion-id> <to-emotion-id>` builds the Stage D preview CLI, loads the 12 default `.exp3.json` files as future Cubism SDK expression load requests, reports a direct expression switch, then reports an accepted model-arbitration probe through the existing safe emotion gate. Output is stable JSON and uses only relative expression file paths.
- `npm run prepare:doudou-live2d-sample -- --sdk-dir <sdk-dir> [--sample Mao] [--out local_live2d_models/default-doudou-sample] [--overwrite]` prepares a local official Sample Data model directory for SDK-pipeline testing. It copies `Samples/Resources/<sample>` from a developer-provided Cubism SDK for Web directory or an official `Live2D/CubismWebSamples` clone into ignored local storage, rewrites a `default-doudou.model3.json` that references the project-owned 12 default 兜兜 `.exp3.json` files, removes copied sample expression files only inside the new local output directory, writes a hidden preparation marker, and emits sanitized JSON without local paths. `--overwrite` is accepted only for an output directory previously created by this helper with that marker; unmarked existing directories return `unsafe_output_dir` instead of being deleted. This is a pipeline diagnostic only and does not satisfy the final default 兜兜 model requirement. A GitHub clone without official Cubism Core can pass this preparation step but the real official smoke must still fail with `sdk_core_missing` until `Core/live2dcubismcore.js` or `Core/live2dcubismcore.min.js` from the official package is present.
- `npm --silent run build:doudou-live2d-runtime-module -- --sdk-dir <sdk-dir> --out local_live2d_runtime/default-doudou-official-runtime.mjs --mode sample` builds a local-only ES module wrapper against the official Cubism SDK for Web sample `LAppModel` plus Framework source. The CLI emits sanitized JSON with `outputFileName`, `Framework/src`, and sample source status only; use `--silent` for shareable logs because npm can otherwise echo command arguments. The output module is intended for `DOUDOU_CUBISM_WEB_RUNTIME_MODULE` and should stay in ignored local storage. `--mode framework` remains available as a lower-level fallback wrapper.
- `npm --silent run smoke:doudou-live2d:official -- --sdk-dir <sdk-dir> (--model-dir <model-dir> | --sample-model Mao [--sample-out local_live2d_models/default-doudou-sample] [--overwrite-sample]) [--out local_live2d_runtime/default-doudou-official-runtime.mjs] [--mode sample|framework]` is the dedicated real local official Web SDK smoke gate. It requires an explicit local SDK path with official Cubism Core plus either a default 兜兜 model path or an official Sample Data model name; with `--sample-model`, it first prepares a local ignored Sample Data model directory through the same sanitized helper, then preflights that generated model layout through the Stage H resolver. `--overwrite-sample` allows repeated smoke runs against the same sample output only when that output carries the helper's hidden marker. It builds the ignored local runtime module, runs the Electron runtime smoke with the official SDK/model/module environment, and emits sanitized pass/fail JSON without printing local paths. Success requires both fixture and generated bundle official renderer evidence to prove `rendererAssetProbe:"model3_fetched"`, `runtimeModuleProbe:"loaded"`, `runtimeFailureReason:null`, `modelLoaded:true`, 12 expressions, multiple non-idle official expression emotions observed through desktop switches, no pending official expression switches, a non-idle active emotion, switched expression applied after a successful frame, switched expression changed rendered Live2D canvas pixels, internal runtime lifecycle evidence for loading 12 expressions, setting at least two expressions, `updateMotion`, model update, and draw, visible Live2D canvas layer with nontransparent rendered pixels in the desktop window, advanced frame loop, and at least two host update/draw calls. If Sample Data preparation fails, the command returns `OFFICIAL_LIVE2D_SAMPLE_MODEL_PREP_FAILED` with a fixed sanitized reason. If the Electron smoke exits but the proof is incomplete, the command returns `OFFICIAL_LIVE2D_EVIDENCE_INCOMPLETE` with sanitized failed-check names, a categorized `failedCheckSummary` for asset/canvas/expression/frame-loop/missing/model/runtime diagnosis, and the parsed official renderer evidence snapshot. If official renderer evidence includes a sanitized fixed-enum `runtimeFailureReason`, the failed-check name includes that enum suffix so summaries can distinguish module, model/expression, expression-switch, and frame-loop failures without exposing raw errors. If the Electron smoke exits nonzero after printing structured official renderer evidence, `OFFICIAL_LIVE2D_RUNTIME_SMOKE_FAILED` also includes that sanitized evidence snapshot; if the process errors or times out before structured evidence is available, it returns `runtime_smoke_error` and no local paths. Official renderer evidence may include a sanitized `runtimeFailureReason` enum (`core_or_module_load_failed`, `model_or_expression_load_failed`, `expression_switch_rejected`, or `frame_failed`) for diagnosis only; raw exception text and local paths are not part of the contract. Environment fallbacks are `DOUDOU_CUBISM_WEB_SDK_DIR`, `DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR`, and optional `DOUDOU_CUBISM_WEB_RUNTIME_MODULE`.
- `src/runtime/default-doudou-live2d-cubism-adapter.ts` is the Stage E Cubism backend boundary. It maps preview load requests to a replaceable backend's `createExpressionMotion` call and maps preview transitions to `startExpressionMotion` playback with `autoDelete:true` and Cubism-style priority values. The committed mock backend records `CubismExpressionMotion.create` and `CubismMotionManager.startMotionPriority` calls for tests; it does not load a real SDK or model.
- `src/runtime/default-doudou-live2d-web-cubism-backend.ts` is the Stage F Web Cubism facade. It implements the unchanged Stage E backend interface by accepting an injected Web SDK-shaped runtime object with `CubismExpressionMotion.create(buffer,size)` and `motionManager.startMotionPriority(motion,autoDelete,priority)`. This keeps Web SDK/Core import and license handling outside the shared adapter.
- `src/runtime/default-doudou-live2d-web-renderer-spike.ts` is the Stage G renderer lifecycle spike. The desktop runtime may be launched with `--live2d-renderer-spike` or `DOUDOU_LIVE2D_RENDERER_SPIKE=1`; main injects a runtime-only default 兜兜 preview library and renderer reports `live2DRendererSpike` smoke evidence. The spike exercises an official Web SDK/Samples-shaped runtime object but does not add Cubism Core, `.moc3`, texture, or model files to `pet bundle v0.1`.
- `src/runtime/default-doudou-live2d-official-sdk-resolver.ts` is the Stage H local official SDK/model resolver. With `--live2d-renderer-spike`, developers may pass `--live2d-sdk-dir <sdk-dir>` / `DOUDOU_CUBISM_WEB_SDK_DIR` and `--live2d-model-dir <model-dir>` / `DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR`; the runtime validates the local Cubism SDK for Web Core script, the Framework source files directly needed by the official sample, official sample source layout, and `default-doudou.model3.json` references as files inside their allowed local roots, including at least one texture for visible renderer proof and an exact 12-entry default 兜兜 expression list. Stale official Sample Data entries such as `expressions/exp_01.exp3.json` fail preflight as `model_expression_mismatch`. The resolver returns only sanitized smoke evidence and renderer file URLs for a model3 probe. The SDK, Cubism Core, `.moc3`, textures, and model files remain local-only and outside `pet bundle v0.1`.
- `src/runtime/default-doudou-live2d-official-renderer-host.ts` is the Stage I external official renderer host. With the same flag, developers may pass `--live2d-runtime-module <module-file>` / `DOUDOU_CUBISM_WEB_RUNTIME_MODULE`; the configured module path must resolve to a local file, then the renderer loads local Core, imports that ES module, gives it the dedicated `#live2d-canvas`, default model URLs, and 12 default expression load requests, then drives `setExpression`, `update`, and `draw` through the desktop frame loop. The module is expected to wrap the locally licensed official sample/framework runtime, return a runtime object with callable `loadModel`, `setExpression`, `update`, and `draw`, return a non-empty handle for every `loadExpression` request, return `true` from `setExpression` only when the expression switch is accepted, expose sanitized finite non-negative internal lifecycle evidence for expression load/set plus update/draw, and stay outside git. Host evidence includes `runtimeFailureReason:null` on non-failing or not-configured paths, or one fixed enum reason for Core/module load, malformed runtime factory output, model/expression load, expression switch acceptance, or frame update/draw failures.
- `src/scripts/build-doudou-live2d-official-runtime-module.ts` is the Stage J local official runtime module builder. In its recommended sample mode, it first requires all directly needed SDK sample/framework source paths to resolve to files, then uses the existing Vite toolchain to bundle a project-owned wrapper around the SDK sample `LAppModel` plus `LAppPal`, initializes `CubismFramework` before constructing the sample `LAppModel`, calls sample `loadAssets`, waits for sample texture setup/CompleteSetup, surfaces texture-load errors as model-load failures without waiting for the full readiness timeout, and drives expression loading through `LAppModel._expressions.setValue` or `.set`; when `getValue` or Map-style `.get` is available, the wrapper verifies the stored expression can be read back before accepting the load. It then drives accepted `setExpression`, rejects explicit sample `setExpression` refusal, calls `LAppPal.updateTime`, and drives expression-manager `updateMotion`, `update`, and `draw` through the renderer host. Its framework mode remains available for lower-level Framework API checks against non-ok asset fetch rejection, model setting parse, moc/model creation, valid positive model canvas size, declared texture slots with file names, expression motion creation/playback, explicit `CubismRenderer_WebGL.startUp` refusal, `CubismMotionManager.updateMotion`, `model.update`, and `CubismRenderer_WebGL.doDrawModel`.
- `src/scripts/doudou-live2d-official-smoke.ts` is the local real-SDK smoke orchestrator. It fails fast when SDK/model paths are missing, can prepare an official Sample Data model when `--sample-model` is provided, rejects sanitized preparation failures, rejects Stage H SDK/model layout failures, builds the runtime module through Stage J, then delegates to `runtime-smoke` with the official Web SDK/model/module environment so the renderer host must load the real module, load the model, switch expressions, and advance update/draw frames. It parses only structured runtime smoke JSON and returns a compact official renderer proof summary rather than raw smoke logs.
- `src/runtime/default-doudou-model-behavior-api.ts` is the Stage L LLM/VLM emotion arbitration and behavior API boundary. It calls an OpenAI-compatible chat completions endpoint through injected or global `fetch`, sends `DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT`, parses only the allowlisted Stage B model suggestion fields, applies the existing safety/runtime/VLM-consent arbitration, and returns a compact runtime behavior command: `set_expression` with an allowlisted emotion id and motion cue, or `keep_current` with a fixed arbitration reason. Runtime emotion model secrets and endpoints must be provided through local ignored configuration such as `DOUDOU_EMOTION_MODEL_ENDPOINT`, `DOUDOU_EMOTION_MODEL_API_KEY`, and `DOUDOU_EMOTION_MODEL_ID`; raw keys, raw provider responses, prompts, source image paths, and selected visual inputs must not be committed or printed in shareable logs.
- `npm run probe:doudou-emotion-model` is the Stage L live probe for the runtime emotion model boundary. It reads only `DOUDOU_EMOTION_MODEL_ENDPOINT`, `DOUDOU_EMOTION_MODEL_API_KEY`, and `DOUDOU_EMOTION_MODEL_ID`, sends one text-only OpenAI-compatible chat completions request through the Stage L schema, applies the returned safe behavior command to the committed default 兜兜 Live2D preview expression library, and emits sanitized JSON with provider-config booleans, command/decision, runtime target, and runtime-apply evidence. When configuration is absent, it exits 0 with a skipped result. It must not print the endpoint, API key, prompt text, raw provider response, source paths, or visual payloads.

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

The guided app is a local Electron manager UI. It lets the user select a PNG/JPEG source image, create a local Style Compare developer preview from derived stylizer previews/contact sheet, choose local, `mock-provider`, or `openai-image` generation, explicitly confirm cloud upload for each cloud generation attempt, create QA preview artifacts, accept the validated bundle into the local library, delete draft or accepted assets, launch the accepted bundle in the desktop runtime, and stop the runtime process it launched. In the guided app only, accepting a new draft replaces a previous app-library install with the same pet id so repeated local generation can still reach launch; the lower-level review CLI still refuses accidental overwrites. Deleting draft or accepted assets clears the app's current source-image selection metadata, including the displayed filename, but does not delete the user's original local image file. The UI does not add fields to `pet bundle v0.1` and does not pass source-image details to the runtime. Runtime stop, drag, scale, cursor-follow motion, emotion memory, motion tuning, and visual pet states are app/runtime workflow state only: the manager keeps the child-process handle, sends termination to that managed process, the runtime keeps a hidden rectangular interaction frame around the pet, reveals that frame only near resize edges or during resize, moves only its own transparent pet window from primary-button drag inside that frame, scales that same window continuously from mouse-wheel input inside the frame, continuously scales from primary-button drag on a frame edge or from `Shift` + primary-button drag inside the frame, treats outward resize drag from the frame center as larger and inward drag as smaller, clamps scale from 50% to 200%, uses visible-alpha cursor hits only to publish runtime motion cues, never moves the overlay window from passive cursor contact, dodges visually when the alpha hit lands near the pet core or when repeated alpha pokes have raised short-lived wariness, maps high wariness into `retreating`, `watching`, then slow `approaching` recovery, lets developer tuning adjust retreat distance, watch pause, and recovery speed without changing bundle data, gradually recovers approach behavior after quiet time, returns motion feedback to waiting when fresh cues stop, pauses during drag/scale gestures, renders runtime-only `approaching`/`dodging`/`retreating`/`watching`/`stopped`/`poked`/`waiting`/`working` visual feedback from existing bundle frames with direction-aware lean, dodge hop, retreat hop, watch lean, stop rebound, and `tap_react` poke expression frames, also stops during app quit, and keeps the runtime/bundle contract unchanged. Mock-cloud mode requires `DOUDOU_MOCK_CLOUD_API_KEY` in the app process environment and still performs no live network call. OpenAI live mode requires `DOUDOU_ENABLE_OPENAI_LIVE=1`, `OPENAI_API_KEY`, and the UI confirmation checkbox.

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
