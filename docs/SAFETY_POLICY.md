<!-- codex-project-bootstrap:generated -->
# Safety Policy


## Guardrails

- Require user confirmation before sending source images to any cloud model or third-party service.
- Treat cloud upload consent as per-generation consent; stored provider configuration must not imply consent to upload a new image.
- Refuse or block workflows that attempt to generate a likeness without appropriate rights or consent.
- Avoid generating sexualized, exploitative, or harassing desktop pets from real people.
- Treat minors, public figures, and private individuals as high-sensitivity likeness cases.
- Do not auto-enable launch-at-login, screen capture, microphone, camera, or network behavior without explicit user action.

## Secrets and Privacy

- Store API keys in the platform keychain or local ignored config, never in committed files.
- Redact secrets, source image paths, and personal metadata from logs and bug reports.
- Keep screenshots and generated fixtures out of git unless they are rights-safe test assets.
- Prefer synthetic fixtures for tests and documentation.
- Do not log raw prompts, raw provider responses, normalized source-image paths, or provider payloads by default.

## Production Risk

- Never run destructive cleanup across broad user directories.
- Never upload local images, pet bundles, logs, or screenshots without a visible user action.
- Avoid global keyboard/mouse hooks unless a feature specifically requires them and the user opts in.
- Desktop overlay behavior must not interfere with secure input, payments, passwords, or full-screen work without a way to disable it.
