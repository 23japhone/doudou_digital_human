<!-- codex-project-bootstrap:generated -->
# Eval Plan


## Scenarios

- Image intake accepts common image formats and rejects unsupported or unsafe inputs with clear messages.
- Generation produces a visually coherent pet bundle from a rights-safe avatar fixture.
- Bundle validation catches missing frames, invalid manifests, oversized assets, and bad transparency.
- Runtime launches a valid bundle, animates idle state, and responds to one interaction.
- Deletion removes source and derived local assets for a generated pet project.

## Metrics

- End-to-end success rate from image to launch.
- Generation latency and cost per pet.
- Bundle validation pass rate.
- Runtime stability: launch success, render loop health, and crash-free session length.
- Visual quality review: identity preservation, style consistency, transparency, and animation smoothness.
- Privacy checks: no source images or secrets in committed fixtures/logs.

## Gates

- MVP demo cannot ship until a rights-safe fixture completes image import, generation, validation, preview, and runtime launch.
- Runtime cannot ship without a way to quit/disable the pet.
- Any cloud model path must have explicit consent text and a local data deletion path.
- Bundle schema changes require validation tests and at least one golden fixture update.
