<!-- codex-project-bootstrap:generated -->
# Roadmap


## Current Phase

Phase 0: project framing, first desktop runtime vertical slice, local source-image intake, deterministic non-model stylized PNG adapter, scripted generation-adapter vertical slice, real image-to-character adapter design spike, cloud-adapter scaffold, preview/QA/deletion workflow, guided desktop UI with mock-cloud selection, and OpenAI live provider scaffold behind explicit opt-in.

Exit criteria: Electron loads a validated `pet bundle v0.1` fixture and generated bundle, renders idle animation in a transparent desktop window, local generation can convert a PNG/JPEG into stylized preview/atlas assets without model calls or source-image retention, generation flows through replaceable local/scripted/cloud adapter boundaries, cloud scaffold uses mocked provider tests with explicit opt-in, OpenAI live smoke is available but skipped by default unless env-gated, review CLI can QA/accept/delete bundles, the guided UI can click through local or mock-cloud generate/QA/accept/delete/launch with explicit confirmation, and validator/unit/build/runtime/app smoke checks pass.

## Next Vertical Slices

1. Add a small rights-safe visual QA corpus for deterministic local stylization and tune crop/mask/color parameters against it.
2. Harden click-through behavior beyond fallbackRect/alpha hit area if macOS manual testing shows input interference.
3. Manually run and evaluate the opt-in OpenAI live smoke with a non-sensitive source image, then compare model quality with the local deterministic fallback.
4. Add local model adapter experiments after cache paths and deletion behavior are designed.

## Deferred Work

- Rich chat/personality memory.
- Marketplace packaging and pet sharing.
- Multi-pet runtime.
- Local model training or fine-tuning.
- Advanced rigging, physics, or 3D avatars.
