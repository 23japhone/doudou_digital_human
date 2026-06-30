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
- Real cloud adapters must show explicit confirmation before upload. Confirmation must state that the selected image and generation instructions leave the machine, that provider retention/policy rules may apply, and that the pet bundle still stores only generated assets plus non-sensitive provenance. `openai-image` live generation is additionally disabled unless `DOUDOU_ENABLE_OPENAI_LIVE=1` and `OPENAI_API_KEY` are present.
- Source normalization creates temporary source-derived PNG files outside the final bundle for cloud adapters. The scaffold deletes those files after success and after mapped provider failures.
- Review/QA artifacts are derived from generated bundle assets only: `review.json`, copied `preview.png`, and copied `contact-sheet.png`. They must not contain source image paths, prompts, raw responses, tokens, or secrets.
- Accepting a bundle copies only the validated pet bundle files into the local library; it must not add installation metadata inside the bundle because unreferenced files break the bundle contract.
- The guided desktop app keeps source image paths in app process state only long enough to call the selected generator. Its renderer-facing state uses the source filename, selected provider id, provider configured flag, live-provider-enabled flag, upload confirmation flag, and generated review artifact URLs; runtime launch receives only the accepted bundle directory. Provider secrets are read by the app process and are not exposed to renderer state.
- When passing personal source-image paths through npm scripts, prefer `npm --silent run generate:pet -- <source> <output>` because npm may echo command arguments in terminal output.
- Do not commit personal images, generated likenesses, API keys, or raw model responses containing private data.
- Fixtures must use rights-safe synthetic images or explicitly licensed assets.
- Provide a deletion path that removes source image copies, derived assets, caches, and generation logs for a pet project. The first deletion CLI requires an explicit allowed root and deletes only child directories under that root.
- Logs should record file IDs or hashes only when useful; avoid absolute personal file paths in shareable logs.

## Cloud and Local Boundary

Cloud generation is allowed only when the user explicitly chooses it and confirms the upload for that generation attempt. Configuring a cloud provider or API key is not enough by itself. `mock-provider` uses `DOUDOU_MOCK_CLOUD_API_KEY` and performs no live network calls. `openai-image` performs a live OpenAI image edit only when the user selects OpenAI Live in the manager, checks the upload confirmation, and the app process has both `DOUDOU_ENABLE_OPENAI_LIVE=1` and `OPENAI_API_KEY`. The live provider receives the normalized source PNG and a fixed generation instruction; the bundle still stores only generated pet assets and allowlisted source metadata.

Local-only mode should remain possible for privacy-sensitive users, even if quality or speed is lower.
