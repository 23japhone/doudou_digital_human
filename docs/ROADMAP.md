<!-- codex-project-bootstrap:generated -->
# Roadmap


## Current Phase

Phase 0: project framing, first desktop runtime vertical slice, local source-image intake, scripted generation-adapter vertical slice, real image-to-character adapter design spike, cloud-adapter scaffold, and preview/QA/deletion workflow.

Exit criteria: Electron loads a validated `pet bundle v0.1` fixture and generated bundle, renders idle animation in a transparent desktop window, generation flows through replaceable scripted/cloud adapter boundaries, cloud scaffold uses mocked provider tests with explicit opt-in, review CLI can QA/accept/delete bundles, and validator/unit/build/runtime smoke checks pass.

## Next Vertical Slices

1. Harden click-through behavior beyond fallbackRect/alpha hit area if macOS manual testing shows input interference.
2. Add a guided desktop UI that calls the existing generate/review/accept/delete modules.
3. Replace the mocked provider with a real image-to-character provider path behind opt-in live smoke.
4. Add local model adapter experiments after cache paths and deletion behavior are designed.

## Deferred Work

- Rich chat/personality memory.
- Marketplace packaging and pet sharing.
- Multi-pet runtime.
- Local model training or fine-tuning.
- Advanced rigging, physics, or 3D avatars.
