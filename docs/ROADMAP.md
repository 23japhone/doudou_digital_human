<!-- codex-project-bootstrap:generated -->
# Roadmap


## Current Phase

Phase 0: project framing, first desktop runtime vertical slice, local source-image intake, deterministic non-model stylized PNG adapter with QA-approved `bold_edges` defaults, local source-image preview comparison, guided manager developer preview for local stylizer comparison, scripted generation-adapter vertical slice, real image-to-character adapter design spike, cloud-adapter scaffold, preview/QA/deletion workflow, guided desktop UI with mock-cloud selection, OpenAI live provider scaffold behind explicit opt-in, and stylizer QA/manual-scoring automation with a change-aware default-parameter gate.

Exit criteria: Electron loads a validated `pet bundle v0.1` fixture and generated bundle, renders idle animation in a transparent desktop window, local generation can convert a PNG/JPEG into stylized preview/atlas assets without model calls or source-image retention, local preview comparison can show `balanced`, `soft_mask`, and `bold_edges` without writing source images, the guided UI can show those local derived stylizer previews/contact sheet through a developer preview entry without changing the runtime or bundle contract, generation flows through replaceable local/scripted/cloud adapter boundaries, cloud scaffold uses mocked provider tests with explicit opt-in, OpenAI live smoke is available but skipped by default unless env-gated, review CLI can QA/accept/delete bundles, the guided UI can click through local or mock-cloud generate/QA/accept/delete/launch/stop with explicit confirmation, stylizer default-parameter changes have a CLI-checkable manual scoring gate that triggers only for default-parameter file changes, the current local default has passed manual scoring evidence, and validator/unit/build/runtime/app smoke checks pass.

## Next Vertical Slices

1. Optionally wire the npm gate script into the team's actual PR required check or local pre-commit hook once the repository hosting workflow is chosen.
2. Harden click-through behavior beyond fallbackRect/alpha hit area if macOS manual testing shows input interference.
3. Manually run and evaluate the opt-in OpenAI live smoke with a non-sensitive source image, then compare model quality with the local deterministic fallback.
4. Add local model adapter experiments after cache paths and deletion behavior are designed.

## Deferred Work

- Rich chat/personality memory.
- Marketplace packaging and pet sharing.
- Multi-pet runtime.
- Local model training or fine-tuning.
- Advanced rigging, physics, or 3D avatars.
