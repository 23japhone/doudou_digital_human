# Real Image-to-Character Adapter Spike

Date: 2026-06-30

## Decision

The first real image-to-character adapter should be a cloud adapter behind explicit user opt-in. The existing scripted adapter remains the default local/no-network path. A local model adapter should use the same adapter contract later, but it is not the first real adapter because local packaging, model weights, GPU/CPU variance, and cache deletion are larger product risks than the adapter boundary itself.

The real adapter must still produce the existing sanitized adapter output:

- `adapterId` and `adapterVersion`
- `petId` and `petName`
- eight transparent 256x256 PNG frames indexed `0..7`
- one transparent 256x256 preview PNG
- no source image paths, prompts, raw provider responses, tokens, secrets, or provider payloads

The runtime must remain unchanged. Generation and runtime continue to communicate only through validated `pet bundle v0.1` directories.

## Provider Boundary

Recommended first provider mode:

- `mode: "cloud"`
- explicit UI or CLI confirmation before any upload
- API key from keychain, ignored local config, or environment variable
- raw request, prompt, and provider response kept out of bundle metadata and default logs
- provider-specific errors mapped into project-owned adapter errors

Rejected for first real adapter:

- implicit network calls from `npm run generate:pet`
- committing sample user images or provider outputs as fixtures
- storing original source images inside pet bundles
- making Electron runtime aware of model/provider details
- building a local Diffusers-style stack before the cloud adapter contract is proven

Future local mode:

- `mode: "local"`
- may use a Python sidecar or separate worker process
- may download/cache model weights, but must declare cache paths and deletion behavior first
- should reuse the same normalized input and adapter output validation

## Input Normalization

Source image intake currently proves that the user supplied a safe local PNG/JPEG that can be decoded. A real adapter needs one additional normalization stage before model invocation.

Normalization should:

- decode to RGBA
- apply image orientation before resizing
- strip EXIF and other source metadata
- reject tiny, huge, animated, or ambiguous images with actionable errors
- resize to a provider-safe working image, preserving aspect ratio
- place the character/reference on a neutral canvas when required by the provider
- write only temporary working files outside the final bundle
- delete temporary normalized images after successful bundle generation or failed cleanup-safe exit

Do not include the original source path, normalized working path, source filename, prompt text, or raw provider response in `source.meta.json`.

Allowlisted generated metadata remains limited to compact provenance:

- `generatedBy`
- `generationAdapter`
- `generationAdapterVersion`
- `sourceType`
- `inputMime`
- `inputBytes`
- `createdAt`
- `sourceImageStored:false`

If normalized image dimensions, a non-reversible hash, or safety classification become useful later, add them through the validator allowlist in a separate schema review.

## Output Pipeline

The real adapter can be implemented as a multi-step pipeline behind the current adapter contract:

1. Normalize source image.
2. Produce a stylized character reference using the selected provider.
3. Convert the reference into an animation-ready frame set.
4. Run post-processing: transparency, centering, canvas size, non-empty frame checks, and preview extraction.
5. Return sanitized adapter output to the existing bundle packager.
6. Let the existing pet bundle validator reject contract drift.

For the first implementation, it is acceptable for the provider to produce a single character/reference image and for local deterministic post-processing to create simple idle/tap frames. The hard requirement is that the adapter boundary returns valid frame PNGs and does not leak provider internals.

## Failure Shape

Real adapters should raise project-owned errors before they reach CLI/UI copy. Suggested codes:

- `CLOUD_OPT_IN_REQUIRED`: user has not explicitly confirmed cloud upload.
- `PROVIDER_NOT_CONFIGURED`: provider adapter selected but API key/config is missing.
- `SOURCE_IMAGE_NORMALIZATION_FAILED`: decode succeeded but normalization failed.
- `SOURCE_IMAGE_TOO_SMALL`: source lacks enough usable pixels for a character reference.
- `SOURCE_IMAGE_TOO_LARGE`: source exceeds normalization limits.
- `MODEL_REFUSED`: provider refused the request for safety or policy reasons.
- `MODEL_RATE_LIMITED`: provider returned rate or quota limits.
- `MODEL_TIMEOUT`: provider call did not complete in the configured time.
- `MODEL_PROVIDER_ERROR`: provider failed without a more specific mapped code.
- `MODEL_OUTPUT_INVALID`: provider output could not be decoded or did not contain usable imagery.
- `POSTPROCESSING_FAILED`: local frame extraction, matting, alignment, or resizing failed.
- `ADAPTER_OUTPUT_INVALID`: final adapter output failed the existing strict adapter validator.

Failure behavior:

- never write a partial final bundle unless `validatePetBundle` passes
- clean temporary normalized/source-derived files on failure
- print concise error codes and messages
- avoid logging personal paths, prompts, raw responses, or provider payloads
- keep retry safe by requiring an empty output directory or a new output directory

## Privacy Confirmation Copy

Cloud generation confirmation:

> Cloud generation will upload your selected image and generation instructions to the selected model provider to create pet assets. Only generated pet assets and non-sensitive provenance are written to the pet bundle. Do not continue unless you have rights or consent to use this image. Provider retention and policy rules may apply.

Actions:

- `Generate with cloud provider`
- `Cancel`
- `Use local/scripted mode`

Local generation/cache notice:

> Local generation keeps the source image on this machine, but may create temporary normalized images and may download model weights into a local cache. Temporary image files should be deleted after generation. Model cache deletion must be available before local model mode is promoted beyond experimental.

Safety refusal copy:

> This image cannot be used for pet generation because it may involve a likeness or content we cannot process safely. Try a different image that you own or have permission to use.

## CLI Shape

Keep the current command local and non-networked:

```bash
npm run generate:pet -- <source-image-path> <output-bundle-dir>
```

Future cloud command should make upload intent visible:

```bash
npm run generate:pet:cloud -- <source-image-path> <output-bundle-dir> --provider <provider-id> --confirm-cloud-upload
```

The CLI must fail with `CLOUD_OPT_IN_REQUIRED` if cloud mode is selected without explicit confirmation.

## Test Plan

Unit tests:

- source normalization strips metadata and rejects unsafe dimensions
- cloud adapter refuses to run without explicit confirmation
- provider config is required but secrets are not printed
- provider errors map to stable project error codes
- provider output with raw response fields is rejected before bundle write
- post-processing produces eight valid transparent 256x256 PNG frames
- `source.meta.json` contains only allowlisted provenance

Integration/smoke:

- default `generate:pet` remains no-network and scripted
- cloud adapter tests use mocked provider responses by default
- live provider smoke is opt-in and skipped unless explicit environment variables are set
- generated cloud bundle passes validator and runtime smoke

Fixtures:

- use synthetic or explicitly licensed images only
- do not commit real personal likenesses, raw provider responses, prompts, or provider screenshots

## References

- OpenAI image generation guide: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI data controls: https://developers.openai.com/api/docs/guides/your-data
- Hugging Face Diffusers image-to-image guide: https://huggingface.co/docs/diffusers/using-diffusers/img2img
- Hugging Face Diffusers installation guide: https://huggingface.co/docs/diffusers/installation
