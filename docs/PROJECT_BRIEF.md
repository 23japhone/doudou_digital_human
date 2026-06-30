<!-- codex-project-bootstrap:generated -->
# Project Brief


## Goal

Build a digital-human desktop pet product inspired by Codex's desktop pet experience. A user provides one source image, the system converts it into a stylized digital character, generates the required desktop-pet assets and metadata, then runs the character as an interactive companion on the user's desktop.

## Audience

- Primary user: a creator or individual user who wants to turn a personal image, avatar, mascot, or character reference into a desktop companion.
- Operator: the person running the local desktop app and asset-generation pipeline.
- Reviewer: maintainers who verify generated assets, privacy handling, desktop runtime behavior, and release quality.

## MVP

The smallest useful demo is: import one image, generate a consistent digital pet asset bundle, preview the pet, and launch it as a desktop overlay with a small set of idle and interaction behaviors.

The MVP should prove the full vertical path before optimizing generation quality or adding many behaviors.

## Non-Goals

- Full social companion memory, chat, or long-running emotional simulation.
- Marketplace distribution, paid customization, or account systems.
- Multi-character scenes, multiplayer, or collaborative desktop spaces.
- Training custom foundation models before a generated-asset workflow is validated.

## Success Criteria

- A user can complete image import to running desktop pet in one guided flow.
- Generated assets preserve recognizable character identity while producing a cute, coherent pet style.
- The desktop pet launches, idles, animates, and responds to at least one interaction without blocking normal desktop use.
- Source images and generated assets have explicit local/cloud handling rules.
- The repo contains enough tests and smoke checks to protect the asset schema and runtime launch path.
