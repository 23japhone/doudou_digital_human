<!-- codex-project-bootstrap:generated -->
# Model I/O Spec


## Inputs

Primary input:

- One user-provided image containing the character, person, mascot, or visual reference to convert.

Optional controls:

- Style preset, such as cute desktop pet, digital human, pixel, sticker, anime, or mascot.
- Target animation set, such as idle only or idle plus tap reaction.
- Output constraints, such as transparent background, max texture size, sprite atlas dimensions, and target platform.

The model layer should receive normalized images and structured controls, not raw UI state. Real model integrations should implement the same generation adapter contract as the default local 兜兜 adapter and the scripted contract-test adapter. The first real adapter should be cloud-backed and opt-in; local model mode remains a later adapter using the same contract.

Normalization before model invocation should decode the image, apply orientation, strip metadata, reject unsafe dimensions, resize to provider-safe limits, and use temporary working files outside the final bundle.

## Outputs

Expected model/pipeline output:

- Character design image or intermediate reference sheet.
- Transparent 256x256 frame sequence for the current `pet bundle v0.1` packager, or a future explicitly versioned asset format.
- Asset metadata: dimensions, frame count, frame timing, anchor points, and behavior labels.
- Validation result with errors or warnings if assets are unusable.

The adapter boundary must expose sanitized assets and compact provenance only. Raw prompts, raw provider responses, tokens, source image paths, and provider-specific payloads must stay outside pet bundles and committed fixtures.

Refusal/error fields should cover unsupported file types, unsafe/unauthorized likeness requests, missing cloud consent, provider configuration failure, provider refusal, rate limits, timeouts, generation failure, adapter-output validation failure, and post-processing failure.

Runtime emotion models are a separate path from generation adapters. For the default 兜兜 desktop pet, LLM/VLM outputs must use the Stage B arbitration schema in `src/runtime/default-doudou-live2d.ts`: the model may output only `source`, `intent`, `suggestedEmotionId`, `confidence`, `reasonCode`, and `ttlMs`. Stage L implements the first runtime API boundary in `src/runtime/default-doudou-model-behavior-api.ts`: it calls an OpenAI-compatible chat completions endpoint only through local ignored configuration, sends the strict response schema, parses only the allowlisted fields, applies the existing arbitration gate, and returns either `set_expression` or `keep_current` for the runtime. It must not output or retain Live2D parameters, expression file names, freeform pet dialogue, source paths, raw prompts, raw provider responses, screen text, provider payloads, endpoints, or API keys. VLM input is allowed only for user-selected source or QA assets with explicit consent, never default desktop, camera, or private window capture; without consent, the API must skip the provider call and keep the current emotion.

## Golden Cases

Add rights-safe fixtures before implementation:

- Simple illustrated avatar to cute desktop pet.
- Mascot/logo-like character to desktop pet.
- Low-quality image rejected with actionable guidance.
- Image with complex background normalized into a transparent pet asset.
