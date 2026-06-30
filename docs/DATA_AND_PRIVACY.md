<!-- codex-project-bootstrap:generated -->
# Data and Privacy


## Data Inventory

Data handled by the product:

- Source images provided by users.
- Normalized working images and masks.
- Generated character references, sprite frames, thumbnails, and pet bundles.
- Model prompts, generation parameters, and validation logs.
- User preferences for the desktop runtime.

## Retention and Redaction

- Default posture: keep source images and generated bundles local.
- `pet bundle v0.1` must not store source image copies or source image paths; later formats need an explicit deletion contract before allowing that.
- The local `generate:pet` CLI validates the source image and records only allowlisted provenance such as MIME type, byte size, creation time, generator name, adapter id/version, and `sourceImageStored:false`.
- Scripted and future real generation adapters must return sanitized asset outputs. Adapter outputs must not include source image paths, raw prompts, raw model responses, provider payloads, tokens, or secrets.
- Real cloud adapters must show explicit confirmation before upload. Confirmation must state that the selected image and generation instructions leave the machine, that provider retention/policy rules may apply, and that the pet bundle still stores only generated assets plus non-sensitive provenance.
- Source normalization creates temporary source-derived PNG files outside the final bundle for cloud adapters. The scaffold deletes those files after success and after mapped provider failures.
- When passing personal source-image paths through npm scripts, prefer `npm --silent run generate:pet -- <source> <output>` because npm may echo command arguments in terminal output.
- Do not commit personal images, generated likenesses, API keys, or raw model responses containing private data.
- Fixtures must use rights-safe synthetic images or explicitly licensed assets.
- Provide a deletion path that removes source image copies, derived assets, caches, and generation logs for a pet project.
- Logs should record file IDs or hashes only when useful; avoid absolute personal file paths in shareable logs.

## Cloud and Local Boundary

Cloud generation is allowed only when the user explicitly chooses it and confirms the upload for that generation attempt. Configuring a cloud provider or API key is not enough by itself. The current scaffold uses `mock-provider` with `DOUDOU_MOCK_CLOUD_API_KEY` and performs no live network calls. The UI and docs must make clear which data leaves the machine before a live provider is added.

Local-only mode should remain possible for privacy-sensitive users, even if quality or speed is lower.
