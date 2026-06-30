<!-- codex-project-bootstrap:generated -->
# Model I/O Spec


## Inputs

Primary input:

- One user-provided image containing the character, person, mascot, or visual reference to convert.

Optional controls:

- Style preset, such as cute desktop pet, digital human, pixel, sticker, anime, or mascot.
- Target animation set, such as idle only or idle plus tap reaction.
- Output constraints, such as transparent background, max texture size, sprite atlas dimensions, and target platform.

The model layer should receive normalized images and structured controls, not raw UI state. Real model integrations should implement the generation adapter contract currently exercised by the scripted adapter.

## Outputs

Expected model/pipeline output:

- Character design image or intermediate reference sheet.
- Transparent 256x256 frame sequence for the current `pet bundle v0.1` packager, or a future explicitly versioned asset format.
- Asset metadata: dimensions, frame count, frame timing, anchor points, and behavior labels.
- Validation result with errors or warnings if assets are unusable.

The adapter boundary must expose sanitized assets and compact provenance only. Raw prompts, raw provider responses, tokens, source image paths, and provider-specific payloads must stay outside pet bundles and committed fixtures.

Refusal/error fields should cover unsupported file types, unsafe/unauthorized likeness requests, generation failure, adapter-output validation failure, and post-processing failure.

## Golden Cases

Add rights-safe fixtures before implementation:

- Simple illustrated avatar to cute desktop pet.
- Mascot/logo-like character to desktop pet.
- Low-quality image rejected with actionable guidance.
- Image with complex background normalized into a transparent pet asset.
