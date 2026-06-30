<!-- codex-project-bootstrap:generated -->
# Architecture


## System Overview

The system is a local-first desktop product with an asset-generation pipeline. Data flows from a user-supplied source image through validation, digital-character generation, asset packaging, preview, and finally a desktop overlay runtime that displays and animates the pet.

The first vertical slice uses Electron and TypeScript for a macOS-first desktop runtime. It loads a local `pet bundle v0.1`, validates the bundle before launch, then renders the pet in a transparent, frameless, always-on-top window. The second vertical slice adds local source-image intake. The third vertical slice routes generation through a scripted adapter that returns frame PNGs shaped like future model output, without connecting a real model provider. The real image-to-character adapter spike chooses a cloud adapter behind explicit opt-in for the first real model path, with local model mode kept behind the same adapter contract for a later slice. The current cloud scaffold uses a mock provider, opt-in gating, provider config checks, source normalization, provider error mapping, and temp cleanup without live network calls. The preview/QA/deletion slice adds a review layer that validates generated bundles, writes inspectable preview artifacts, accepts bundles into a local library, and deletes review or library directories within an explicit allowed root.

Initial components:

- Image intake: validates file type, dimensions, consent metadata, and prepares normalized image inputs.
- Character generation: converts the source image into a stylized digital-human or mascot design.
- Pet asset builder: produces animation frames, sprite sheets, transparent assets, manifests, and thumbnails.
- Preview and QA: renders generated assets for inspection before installation.
- Desktop runtime: loads a pet bundle, renders it above the desktop, and handles idle/interaction behaviors.
- Behavior engine: owns pet states, transitions, timers, and user-triggered actions.
- Storage: owns local project files, generated bundles, cache, and deletion flows.

## Module Boundaries

- Generation code must not depend on desktop-window APIs.
- Runtime code must consume versioned pet bundles and should not know model-specific generation details.
- Privacy and storage code must be the only layer that decides retention, cache, and deletion behavior.
- UI code should orchestrate flows and render state, not embed model prompts or asset-schema rules.
- Tests and fixtures should mirror these domains instead of accumulating in flat root folders.

## Source Layout

Current implementation layout:

- `src/pet_bundle/` for schemas, manifest validation, sprites, and packaging.
- `src/intake/` for local source-image validation.
- `src/generation/` for bundle generation, adapter contracts, and model-adapter boundaries.
- `src/generation/adapters/` for fake/scripted adapters now and real local/cloud adapters later.
- `src/generation/normalization/` for source-derived temporary working images used by provider adapters.
- `src/review/` for preview, QA, accept/install, and deletion workflows that consume already generated bundles.
- `src/runtime/` for desktop overlay and behavior state machine.
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
- Adapter output is a transparent 256x256 PNG frame sequence plus preview metadata; bundle packaging converts those frames into the v0.1 atlas consumed by runtime.
- Real cloud generation must require explicit user confirmation before upload and must not change the runtime/bundle boundary.
- Source image normalization is a generation concern: decode, orient, strip metadata, resize, create temporary working images, then delete temporary source-derived files outside the final bundle.
- Cloud scaffold bundles set `privacy.cloudGenerated:true`; scripted/local bundles keep it false.
- Review artifacts are outside the pet bundle contract. Accepted bundles remain valid `pet bundle v0.1` directories without extra installation metadata files.

## Open Questions

- Which cloud provider should implement the first opt-in real adapter?
- Should the next runtime milestone improve pixel-accurate click-through beyond the current fallbackRect/alpha hit area strategy?
- What normalized image dimension limits should the first provider adapter enforce?
