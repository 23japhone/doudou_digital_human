<!-- codex-project-bootstrap:generated -->
# Testing


## Required Commands

- Lint/static check: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: `npm test`
- Build: `npm run build`
- Generate local pet bundle: `npm run generate:pet -- <source-image-path> <output-bundle-dir>`
- Review generated pet bundle: `npm run review:pet -- qa <bundle-dir> <review-dir>`
- Accept generated pet bundle: `npm run review:pet -- accept <bundle-dir> <library-dir>`
- Delete review or accepted assets: `npm run review:pet -- delete <target-dir> --root <allowed-root>`
- Guided desktop app: `npm run dev:app`
- Guided desktop app smoke: `npm run smoke:app`
- Guided desktop app live smoke: `npm run smoke:app:live` (skips unless `DOUDOU_ENABLE_OPENAI_LIVE=1` and `OPENAI_API_KEY` are set)
- Fixture validation: `npm run validate:fixture`
- Runtime smoke: `npm run smoke:runtime`

## Test Strategy

- Unit test image validation, manifest parsing, bundle validation, and behavior state transitions.
- Use fake/scripted model adapters for deterministic generation tests and verify adapter outputs before bundle packaging.
- Real cloud adapter scaffold tests use mocked provider calls only. OpenAI live-provider smoke requires explicit environment opt-in and is skipped by default.
- Keep a tiny rights-safe golden fixture bundle for regression tests.
- Add smoke tests for preview rendering and desktop runtime launch once a runtime stack exists.
- Add visual QA snapshots/contact sheets for generated sprite assets.
- Review workflow tests cover QA report creation, accepted bundle validation, deletion safety, and privacy-safe review/install metadata.
- Runtime smoke covers missing manifest, missing asset, unsupported schema, then launches the fixture and a generated bundle. Both require structured renderer evidence: bundle loaded, atlas loaded, nontransparent canvas pixel, and idle animation advance.
- Guided app smoke launches the Electron manager UI, selects mock-cloud generation, confirms upload, clicks through source selection, generation, QA, accept, runtime launch, draft deletion, and accepted deletion, then verifies the runtime smoke evidence returned through the UI flow. The live smoke reuses this flow with `openai_live` only when the required env vars are present.

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
- Runtime behavior changes include state-machine tests or smoke coverage.
- UI flow changes include at least one end-to-end or manual smoke checklist.
- Privacy-sensitive changes verify logs, fixtures, and errors do not expose source images or secrets.
- Fixture assets must be synthetic or explicitly licensed. The current fixture is generated from simple project-owned geometric shapes.
- Bundle validation changes must keep negative coverage for unreferenced files, source-like payloads, bad preview images, missing assets, and unsupported schema versions.
- Generation adapter changes must cover valid frame output, missing frames, out-of-range frame indexes, bad preview assets, and sanitized provenance metadata.
- Real adapter changes must cover cloud confirmation gating, provider config failures, source normalization cleanup, provider error mapping, live-provider env gating, `privacy.cloudGenerated`, and no leakage of raw prompts, raw responses, tokens, or source paths.
- Review/deletion changes must cover invalid bundle rejection before artifact creation, accepted bundle validation, refusal to overwrite installs, refusal to delete outside the allowed root, and no absolute path or secret leakage in review/install records.
- Guided UI changes must include a flow-level unit test plus an Electron smoke that proves renderer buttons can drive local or mock-cloud generate, QA, accept/delete, and launch without leaking source paths or provider secrets in smoke output.
