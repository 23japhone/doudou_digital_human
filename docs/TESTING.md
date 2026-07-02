<!-- codex-project-bootstrap:generated -->
# Testing


## Required Commands

- Lint/static check: `npm run lint` (includes the change-aware stylizer default gate)
- Typecheck: `npm run typecheck`
- Unit tests: `npm test`
- Build: `npm run build`
- Generate local pet bundle: `npm run generate:pet -- <source-image-path> <output-bundle-dir>`
- Generate stylizer visual QA corpus: `npm run qa:stylizer -- <output-dir>`
- Generate local-image stylizer preview comparison: `npm run qa:stylizer:compare -- <source-image-path> <output-dir>`
- Check stylizer default-preset scoring gate: `npm run qa:stylizer:check -- <manual-scoring-template.json> <candidate-preset>`
- Run change-aware stylizer default gate: `npm run qa:stylizer:default-gate -- [--changed-file <path>...] [--staged] [--base <ref> [--head <ref>]] [manual-scoring-template.json candidate-preset]`. CI or hooks may pass evidence with `STYLIZER_SCORING_FILE=<manual-scoring-template.json>` and `STYLIZER_CANDIDATE_PRESET=<candidate-preset>`.
- Review generated pet bundle: `npm run review:pet -- qa <bundle-dir> <review-dir>`
- Accept generated pet bundle: `npm run review:pet -- accept <bundle-dir> <library-dir>`
- Delete review or accepted assets: `npm run review:pet -- delete <target-dir> --root <allowed-root>`
- Guided desktop app: `npm run dev:app` (full manager flow; launched pets can be stopped from the Stop button). See [Guided App Quickstart](GUIDED_APP_QUICKSTART.md) for the shortest manual path and developer smoke checklist.
- Guided desktop app smoke: `npm run smoke:app`
- Guided desktop app live smoke: `npm run smoke:app:live` (skips unless `DOUDOU_ENABLE_OPENAI_LIVE=1` and `OPENAI_API_KEY` are set). Use `npm run smoke:app:live -- --source <image-path>` or `DOUDOU_APP_SMOKE_SOURCE_IMAGE=<image-path>` to run the live smoke against a specific local source image; explicit source-image smoke also requires `DOUDOU_CONFIRM_SOURCE_UPLOAD=1`.
- Guided app Chinese visual QA: `npm run qa:app:visual` launches the built Electron manager at the minimum supported window size, injects representative Chinese source filename, status/error, provider, action, and QA text, saves a screenshot under `output/playwright/`, and fails on text overflow or overlapping controls.
- OpenAI-compatible image provider probe: `npm run probe:openai-image` uploads only a synthetic PNG and verifies that the configured endpoint supports image edits before any user source image is used.
- Fixture validation: `npm run validate:fixture`
- Runtime smoke: `npm run smoke:runtime`

## Test Strategy

- Unit test image validation, manifest parsing, bundle validation, and behavior state transitions.
- Use the deterministic stylized PNG adapter for local source-image-to-bundle tests, including source-palette evidence in generated previews. Use fake/scripted model adapters for contract tests and verify adapter outputs before bundle packaging.
- Use `npm run qa:stylizer -- <output-dir>` for rights-safe visual tuning of deterministic crop, mask, color, and edge parameters. The generated report, contact sheet, manual scoring checklist, and scoring JSON template are local QA artifacts; commit only the code-defined synthetic corpus and tests unless a fixture has an explicit rights-safe reason.
- Use `npm run qa:stylizer:compare -- <source-image-path> <output-dir>` for one-off local source image comparison across `balanced`, `soft_mask`, and `bold_edges`. The command writes derived previews and a relative-path report only; do not commit personal source images or generated likenesses from this output.
- Default deterministic stylizer parameter changes require completed manual visual scoring evidence. The scoring dimensions are crop fit, mask silhouette, color preservation, edge clarity, and pet cuteness; a candidate default preset must meet the documented minimum per-dimension and average score thresholds before defaults are changed. The current default is the QA-approved `bold_edges` preset. Use `npm run qa:stylizer:check -- <manual-scoring-template.json> <candidate-preset>` as the scoring proof and `npm run qa:stylizer:default-gate -- ...` as the change-aware repository check. The first implementation chooses an npm script check over a committed pre-commit hook or GitHub Actions job because it has no new dependencies, works locally through `npm run lint`, and can be reused by either hook/CI surface later.
- Real cloud adapter scaffold tests use mocked provider calls only. OpenAI live-provider smoke requires explicit environment opt-in and is skipped by default. Run `npm run probe:openai-image` against a new custom endpoint before using `smoke:app:live -- --source <image-path>`.
- Keep a tiny rights-safe golden fixture bundle for regression tests.
- Add smoke tests for preview rendering and desktop runtime launch once a runtime stack exists.
- Add visual QA snapshots/contact sheets for generated sprite assets.
- Review workflow tests cover QA report creation, accepted bundle validation, deletion safety, and privacy-safe review/install metadata.
- Runtime smoke covers missing manifest, missing asset, unsupported schema, then launches the fixture and a generated bundle. Both require structured renderer evidence: bundle loaded, atlas loaded, drag moved, alpha-gated mouse-follow motion moved the overlay window, cursor-follow alpha hit testing ran, observed `approaching`, `stopped`, `clicked`, `waiting`, and `working` runtime states, motion direction observed, stop rebound strength above zero, `tap_react` expression frames observed, visual state class applied, interaction frame hidden by default, interaction frame visible on resize affordance, scale changed from wheel input, scale changed from pointer drag input, nontransparent canvas pixel, and idle animation advance.
- Guided app smoke launches the Electron manager UI, selects mock-cloud generation, confirms upload, clicks through source selection, local Style Compare developer preview, generation, QA, accept, runtime launch, draft deletion, and accepted deletion, then verifies the developer preview images and runtime smoke evidence returned through the UI flow. Flow-level unit tests cover managed runtime launch/stop behavior, including keeping Stop available after draft cleanup while a pet is running. The live smoke reuses this flow with `openai_live` only when the required env vars are present, and can use either its synthetic source image or an explicit `--source` / `DOUDOU_APP_SMOKE_SOURCE_IMAGE` path.
- Guided app visual QA covers the Chinese layout surface rather than workflow behavior. It should be run after visible Chinese copy, button labels, status text, or sidebar layout changes. Generated screenshots are local QA artifacts and must stay out of git.

## Test Layout

Tests should mirror functional domains:

- `tests/intake/`
- `tests/generation/`
- `tests/pet_bundle/`
- `tests/runtime/`
- `fixtures/pet_bundles/`
- `fixtures/source_images/`

Fixtures must be small, rights-safe, and documented.

## Acceptance Checks

- New bundle schema fields include validation tests.
- Runtime behavior changes include state-machine tests or smoke coverage. Cursor-follow changes should cover inside/outside activation, rendered alpha hit testing, and stale motion-cue decay.
- UI flow changes include at least one end-to-end or manual smoke checklist.
- Privacy-sensitive changes verify logs, fixtures, and errors do not expose source images or secrets.
- Fixture assets must be synthetic or explicitly licensed. The current fixture is generated from simple project-owned geometric shapes.
- Bundle validation changes must keep negative coverage for unreferenced files, source-like payloads, bad preview images, missing assets, and unsupported schema versions.
- Generation adapter changes must cover valid frame output, source-derived local stylization where applicable, missing frames, out-of-range frame indexes, bad preview assets, and sanitized provenance metadata.
- Deterministic stylizer default-parameter changes must include generated stylizer QA artifacts and completed manual scoring evidence before changing the default adapter constants. The scoring JSON must pass `npm run qa:stylizer:check -- <manual-scoring-template.json> <candidate-preset>`, and the changed file set must pass `npm run qa:stylizer:default-gate -- ...` so scoring is required only when default stylizer parameter files changed.
- Real adapter changes must cover cloud confirmation gating, provider config failures, source normalization cleanup, provider error mapping, live-provider env gating, `privacy.cloudGenerated`, and no leakage of raw prompts, raw responses, tokens, or source paths.
- Review/deletion changes must cover invalid bundle rejection before artifact creation, accepted bundle validation, refusal to overwrite installs, refusal to delete outside the allowed root, and no absolute path or secret leakage in review/install records.
- Guided UI changes must include a flow-level unit test plus an Electron smoke that proves renderer buttons can drive local developer preview, local or mock-cloud generate, QA, accept/delete, and launch without leaking source paths or provider secrets in smoke output.
- Guided UI visible-copy or layout changes should also run `npm run qa:app:visual` to prove Chinese buttons, status/error text, and QA labels do not overflow or overlap at the minimum supported window size.
