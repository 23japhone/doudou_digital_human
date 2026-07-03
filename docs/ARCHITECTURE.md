<!-- codex-project-bootstrap:generated -->
# Architecture


## System Overview

The system is a local-first desktop product with an asset-generation pipeline. Data flows from a user-supplied source image through validation, digital-character generation, asset packaging, preview, and finally a desktop overlay runtime that displays and animates the pet.

The first vertical slice uses Electron and TypeScript for a macOS-first desktop runtime. It loads a local `pet bundle v0.1`, validates the bundle before launch, then renders the pet in a transparent, frameless, always-on-top window. The runtime uses rendered canvas alpha for pet hit testing and falls back to the manifest rectangle only when pixel sampling is unavailable. The runtime also owns cursor-following visual state: the main process polls the global cursor, uses the current window rectangle only as a coarse prefilter, asks the renderer to confirm that the pointer maps to visible pet alpha, classifies the alpha hit as approach or dodge based on its canvas position, calculates dominant motion direction and intensity for visual cues, and pauses passive cursor cues during user drag or scale gestures. Passive cursor contact must not move the overlay window; window position changes only from primary-button drag after the pet has been selected. Alpha taps enter a runtime-only `poked` reaction while still using the bundle's `tap_react` animation. The main process also keeps a short-lived runtime-only emotion memory: repeated alpha pokes raise wariness, high wariness maps into a richer response sequence of short retreat, cursor-watching pause, and slower recovery approach, and quiet time after the last poke decays wariness so the pet returns to normal approach behavior. Runtime motion tuning is also runtime-only: defaults preserve the current feel, `--tuning` or `DOUDOU_RUNTIME_TUNING=1` exposes a developer panel for retreat distance, watch pause, and recovery speed, optional environment variables can seed those values before launch, and named local presets are stored in runtime user data rather than in pet bundles. When fresh cursor-follow cues stop, the renderer lets motion states decay back to `waiting` so the pet does not keep acting after the pointer leaves. The renderer keeps runtime-only `approaching`, `dodging`, `retreating`, `watching`, `stopped`, `poked`, `waiting`, and `working` states, maps them onto the existing `idle`/`tap_react` atlas frames, records default 兜兜 emotion ids and scenarios for smoke evidence, uses direction-aware lean, dodge hop, retreat hop, watch lean, stop rebound, breathing, and poke-pop CSS treatments, and keeps all of that outside the pet bundle contract. The second vertical slice adds local source-image intake. The default local generation path now uses a deterministic, non-model stylized PNG adapter: it normalizes the selected image locally, posterizes source pixels, adds edge lines and a transparent character mask, then writes `preview.png` and `atlases/main.png`. The deterministic adapter exposes crop, mask, color, and edge parameters, and the stylizer QA corpus runs multiple rights-safe synthetic images through preset parameter sets for visual comparison. The scripted adapter remains useful for contract tests and future model-output shims. The real image-to-character adapter spike chooses a cloud adapter behind explicit opt-in for the first real model path, with local model mode kept behind the same adapter contract for a later slice. The current cloud scaffold uses a mock provider, opt-in gating, provider config checks, source normalization, provider error mapping, and temp cleanup. An OpenAI image provider is connected only through the guided manager's `openai_live` mode and remains disabled unless `DOUDOU_ENABLE_OPENAI_LIVE=1`, `OPENAI_API_KEY`, and per-generation UI upload confirmation are all present. The preview/QA/deletion slice adds a review layer that validates generated bundles, writes inspectable preview artifacts, accepts bundles into a local library, and deletes review or library directories within an explicit allowed root. The guided desktop UI slice adds an Electron manager window that orchestrates local image selection, local stylizer developer preview comparison, local deterministic generation, mock-cloud, or opt-in OpenAI live generation, explicit upload confirmation, QA preview, accept/delete, and launch while the overlay runtime still consumes only validated bundles.

Initial components:

- Image intake: validates file type, dimensions, consent metadata, and prepares normalized image inputs.
- Character generation: converts the source image into a stylized digital-human or mascot design. The local MVP path is deterministic image processing, not model generation.
- Pet asset builder: produces animation frames, sprite sheets, transparent assets, manifests, and thumbnails.
- Preview and QA: renders generated assets for inspection before installation.
- Desktop runtime: loads a pet bundle, renders it above the desktop, and handles idle/interaction behaviors.
- Behavior engine: owns pet states, transitions, timers, user-triggered actions, and runtime-only cursor-follow motion.
- Storage: owns local project files, generated bundles, cache, and deletion flows.

## Module Boundaries

- Generation code must not depend on desktop-window APIs.
- Runtime code must consume versioned pet bundles and should not know model-specific generation details.
- Default 兜兜 Live2D emotion mapping is a runtime research contract: emotion ids map to Cubism expression specs and model suggestions map only through a safe arbitration layer. It must not couple runtime to raw LLM/VLM provider payloads.
- Privacy and storage code must be the only layer that decides retention, cache, and deletion behavior.
- UI code should orchestrate flows and render state, not embed model prompts or asset-schema rules.
- Tests and fixtures should mirror these domains instead of accumulating in flat root folders.

## Source Layout

Current implementation layout:

- `src/pet_bundle/` for schemas, manifest validation, sprites, and packaging.
- `src/intake/` for local source-image validation.
- `src/generation/` for bundle generation, adapter contracts, and model-adapter boundaries.
- `src/generation/adapters/` for the deterministic local stylizer, scripted contract adapters, and real local/cloud adapters later.
- `src/generation/normalization/` for source-derived temporary working images used by provider adapters.
- `src/generation/stylizer-qa.ts` for the rights-safe synthetic visual QA corpus and parameter-preset batch runner.
- `src/review/` for preview, QA, accept/install, and deletion workflows that consume already generated bundles.
- `src/app/` for the guided desktop manager UI and app-level flow orchestration.
- `src/runtime/` for desktop overlay and behavior state machine.
- `src/runtime/default-doudou-exp3.ts`, `src/runtime/default-doudou-live2d-preview.ts`, `src/runtime/default-doudou-live2d-cubism-adapter.ts`, `src/runtime/default-doudou-live2d-web-cubism-backend.ts`, `src/runtime/default-doudou-live2d-web-renderer-spike.ts`, `src/runtime/default-doudou-live2d-official-sdk-resolver.ts`, `src/runtime/default-doudou-live2d-official-renderer-host.ts`, `src/scripts/build-doudou-live2d-official-runtime-module.ts`, `src/cli/doudou-live2d-exp3.ts`, and `src/cli/doudou-live2d-preview.ts` for default 兜兜 Live2D `.exp3.json` research fixture generation, validation, preview switching, SDK-adapter boundary checks, isolated Web SDK facade experiments, renderer-side lifecycle smoke, optional local official SDK/model path validation, an external official renderer module host, and a local-only official Framework wrapper builder. These files stay outside `pet bundle v0.1`.
- `tests/<domain>/` for tests mirroring source domains.
- `fixtures/<domain>/` for small, rights-safe sample assets.

Future generation work should add:

- model adapters, prompts, and post-processing inside `src/generation/adapters/` without changing the runtime contract.
- `src/ui/` for app screens and preview tools.

Root files should be limited to stable entrypoints, project config, and compatibility wrappers.

## Key Decisions

- Start with one end-to-end vertical slice rather than separate research prototypes.
- Treat generated pet bundles as a versioned contract between generation and runtime.
- Keep source images local by default; any cloud model call must be explicit and documented.
- Use replaceable model/runtime adapters so early choices do not lock the whole product.
- Use Electron for the first runtime because transparent/frameless/always-on-top windows and mouse-event forwarding are first-slice requirements.
- Use a fixed-grid PNG sprite atlas for `pet bundle v0.1`: 256x256 frames, 4x2 atlas, `idle` and `tap_react` animations.
- Use `pngjs` for PNG decode and `jpeg-js` for JPEG decode in local source-image intake; Node and the existing PNG-only dependency cannot fully decode JPEG inputs.
- Use the deterministic stylized PNG adapter as the default non-model local MVP: resize to a 256x256 temporary PNG, derive colors from source pixels, posterize/edge-detect, mask to a transparent character sticker, and animate that sticker into the fixed v0.1 frame sequence.
- Keep stylizer tuning as explicit adapter parameters for crop, mask, color, and edge behavior. Batch comparisons should use project-owned synthetic source images, not personal photos.
- Treat deterministic stylized output as a generated asset that may still preserve likeness. It is local-only and does not store the original source image, but it is not an anonymization step.
- Adapter output is a transparent 256x256 PNG frame sequence plus preview metadata; bundle packaging converts those frames into the v0.1 atlas consumed by runtime.
- Real cloud generation must require explicit user confirmation before upload and must not change the runtime/bundle boundary.
- Source image normalization is a generation concern: decode, orient, strip metadata, resize, create temporary working images, then delete temporary source-derived files outside the final bundle. Both deterministic local stylization and cloud adapters consume normalized source-derived PNGs rather than raw source paths.
- Cloud scaffold bundles set `privacy.cloudGenerated:true`; scripted/local bundles keep it false.
- Review artifacts are outside the pet bundle contract. Accepted bundles remain valid `pet bundle v0.1` directories without extra installation metadata files.
- The guided app owns user workflow state and local workspace paths, but launch still hands only an accepted bundle path to the desktop runtime. When launched from the guided app, the app keeps the child-process handle so the user can stop that managed desktop pet, including during app quit, without changing the runtime or pet bundle contract.
- The guided app's developer style comparison wraps `qa:stylizer:compare` as a manager-only preview surface. It writes local derived preview PNGs, a contact sheet, and a sanitized report under the app workspace; renderer state exposes only artifact URLs and never source paths. These artifacts are not pet bundles and are not consumed by the runtime.
- Guided cloud mode supports `mock-provider` by default and an `openai-image` live provider only when `DOUDOU_ENABLE_OPENAI_LIVE=1` and `OPENAI_API_KEY` are set. Both cloud modes still require explicit upload confirmation before generation.
- The Web Cubism renderer spike is runtime-only and flag-gated by `--live2d-renderer-spike` / `DOUDOU_LIVE2D_RENDERER_SPIKE=1`. Main injects a default 兜兜 preview library into the renderer; the renderer uses an official Web SDK-shaped runtime object to exercise expression creation, expression playback, `updateMotion`, model update, and draw lifecycle evidence without changing bundle schema or committing Cubism Core/model assets.
- Optional official Web SDK/model resolution also stays in runtime integration. Developers can point the runtime at a local Cubism SDK for Web directory and a local default 兜兜 model directory; main validates layout and safe model references, renderer probes `default-doudou.model3.json`, and smoke reports sanitized availability. The repository still does not own SDK licensing, Core binaries, `.moc3`, textures, or model files.
- Optional official runtime module hosting also stays in runtime integration. Developers can point the renderer at a local ES module wrapper around the official sample/framework runtime; the renderer loads local Core, gives the wrapper a dedicated WebGL canvas, default model URLs, and expression load requests, waits for pending official expression switches to settle before smoke reporting, and records only sanitized lifecycle counts including internal `updateMotion`, model update, draw evidence, and pending-switch counts. The repository still does not own that wrapper or any licensed runtime assets.
- The local official runtime module builder is a developer tool, not production runtime code. It consumes a developer-provided Cubism SDK for Web directory, bundles a project-owned wrapper around official sample `LAppModel` plus Framework source classes, writes the generated ES module to an ignored local path such as `local_live2d_runtime/`, and reports only sanitized filenames/status. The recommended sample mode drives sample `loadAssets`, `setExpression`, `update`, `draw`, and instrumented expression-manager `updateMotion`; the lower-level framework mode remains available for direct model setting, moc, expression motion, motion manager, `CubismMotionManager.updateMotion`, and WebGL renderer checks. Core and model assets still come from explicit local paths at runtime.
- The real local official Live2D smoke gate is also a developer tool. It requires explicit local SDK and default 兜兜 model paths, builds the ignored runtime module, runs the existing Electron runtime smoke with the official SDK/model/module environment, and emits only sanitized pass/fail JSON so shareable logs do not expose local asset paths.
- The runtime renderer CSP allows `connect-src 'self' file:` and `script-src 'self' file:` so local Cubism `model3.json`, related file assets, Core, and the explicitly configured local runtime module can be read by the Web SDK path, while network origins remain closed.

## Open Questions

- Which cloud provider should implement the first opt-in real adapter?
- Does macOS manual testing show any remaining input interference with the current canvas-alpha/fallbackRect hit-area strategy?
- What normalized image dimension limits should the first provider adapter enforce?
