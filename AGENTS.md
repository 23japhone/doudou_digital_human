<!-- codex-project-bootstrap:generated -->
# AGENTS.md

## Project

Type: AI Agent

Product: image-to-desktop-pet digital human. The core goal is to take a user-provided image, transform it into a digital character asset, and run it as a cute desktop companion inspired by Codex's desktop pet experience.

This file is the short Codex entrypoint. Keep durable project details in `docs/` and update this file only when Codex needs different default behavior.

## Read Map

- Product scope or milestone changes: read `docs/PROJECT_BRIEF.md` and `docs/ROADMAP.md`.
- Architecture or module-boundary changes: read `docs/ARCHITECTURE.md`.
- API, schema, CLI, event, or integration changes: read `docs/INTERFACES.md`.
- Safety-sensitive changes: read `docs/SAFETY_POLICY.md`.
- Testing or verification changes: read `docs/TESTING.md`.
- 阶段模块实现/实现-review-修复循环：读 `.codex/skills/stage-module-loop/SKILL.md`.
- Terminology questions: read `docs/GLOSSARY.md`.
- Agent runtime/model/eval changes: read `docs/AGENT_RUNTIME.md`, `docs/MODEL_IO_SPEC.md`, and `docs/EVAL_PLAN.md`.
- Data, privacy, or cloud/local boundary changes: read `docs/DATA_AND_PRIVACY.md`.

## Working Rules

- Start with a small, testable vertical slice.
- Prefer existing project patterns over new abstractions.
- Put new code, tests, and fixtures in the existing functional domain that owns the behavior.
- Do not default new modules into a flat package root; keep root files for stable entrypoints or compatibility wrappers.
- Do not add production dependencies without explaining why.
- Do not put secrets in code, docs, tests, logs, or fixtures.
- Plan broad structural migrations first, then move mechanically in small verified phases.
- When requirements are unclear, ask or record explicit assumptions before implementing.

## Verification

- Format/check: `npm run lint`
- Type/build: `npm run typecheck` and `npm run build`
- Tests: `npm test`
- Fixture validation: `npm run validate:fixture`
- Smoke/e2e: `npm run smoke:runtime`

Before claiming completion, run the smallest relevant verification commands and report exact results.

## Final Response

Always report:

1. What changed
2. How it was verified
3. Remaining risks or skipped checks
4. Recommended next step
