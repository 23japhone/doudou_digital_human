<!-- codex-project-bootstrap:generated -->
# Glossary


## Terms

- Source image: the user-provided image used to create a pet.
- Digital human: the stylized character identity derived from the source image.
- Desktop pet: the always-available desktop overlay companion rendered by the runtime.
- Pet bundle: the versioned folder containing manifest, assets, metadata, and previews needed to run a pet.
- Sprite atlas: a single image containing multiple animation frames.
- Behavior state: a named runtime mode such as idle, tap reaction, sleep, or drag.
- Local-only mode: operation where source images and generated assets do not leave the user's machine.

## Naming Rules

- Use "pet bundle" for the generated artifact consumed by the runtime.
- Use "source image" for the original user input, not "training image".
- Use "runtime" for the desktop overlay app, and "generation pipeline" for image-to-asset creation.
- Avoid implying that the first MVP includes chat, memory, or autonomous desktop control.
