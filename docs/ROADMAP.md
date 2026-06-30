<!-- codex-project-bootstrap:generated -->
# Roadmap


## Current Phase

Phase 0: project framing, first desktop runtime vertical slice, local source-image intake, scripted generation-adapter vertical slice, and real image-to-character adapter design spike.

Exit criteria: Electron loads a validated `pet bundle v0.1` fixture and generated bundle, renders idle animation in a transparent desktop window, generation flows through a replaceable scripted adapter, real-adapter cloud/local boundaries are documented, and validator/unit/build/runtime smoke checks pass.

## Next Vertical Slices

1. Harden click-through behavior beyond fallbackRect/alpha hit area if macOS manual testing shows input interference.
2. Add a real cloud adapter scaffold with mocked provider tests, explicit cloud confirmation, and no live network by default.
3. Add source normalization and temporary-file cleanup before any live provider integration.
4. Add preview, QA, and deletion flows.
5. Replace the mocked provider with a real image-to-character provider path behind opt-in live smoke.

## Deferred Work

- Rich chat/personality memory.
- Marketplace packaging and pet sharing.
- Multi-pet runtime.
- Local model training or fine-tuning.
- Advanced rigging, physics, or 3D avatars.
