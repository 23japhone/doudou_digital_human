---
name: stage-module-loop
description: Use when a user asks Codex to deliver a staged module, vertical slice, or feature block in this project as a self-contained coding task, including verification and committing without separate follow-up prompts.
---

# Stage Module Loop

## Overview

Drive one project module from intent to a reviewed, verified commit. Keep the loop tight: understand the target, implement the smallest complete slice, verify it, review it, fix findings, and commit once the work passes.

## Entry

1. Read `AGENTS.md`.
2. Load only the docs needed for the module impact:
   - Scope or milestone: `docs/PROJECT_BRIEF.md`, `docs/ROADMAP.md`
   - Architecture or boundaries: `docs/ARCHITECTURE.md`
   - API, schema, CLI, event, or integration: `docs/INTERFACES.md`
   - Safety or privacy: `docs/SAFETY_POLICY.md`, `docs/DATA_AND_PRIVACY.md`
   - Testing or verification: `docs/TESTING.md`
3. Derive concrete success criteria from the user's module name and goal. Ask only if missing information would make implementation unsafe or likely wrong.
4. Run `git status --short` before editing. Treat existing changes as user-owned unless clearly made for this task.

## Implementation

1. For non-trivial modules, share a short plan before editing.
2. Prefer TDD. If full TDD is not practical, add focused regression tests before or alongside implementation and explain the tradeoff.
3. Keep edits inside the owning domain. Avoid unrelated refactors, broad migrations, or new dependencies unless required and explained.
4. Preserve the project boundary: generation and runtime communicate through versioned pet bundles; runtime must not learn source-image or generation internals.
5. For safety-sensitive work, explicitly check secrets, source image retention, path traversal, remote URLs, logs, fixtures, and metadata leakage.

## Verification

Run the smallest relevant checks while iterating, then run broader gates according to impact:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run validate:fixture`
- `npm run smoke:runtime`

Do not run every command reflexively on tiny changes. The final report must list exact commands run, results, skipped checks, and why each skipped check was safe to skip.

## Internal Review Loop

After implementation and verification, perform an internal code-review pass before declaring success. Do not ask the user to send `/review`; run the review yourself in the same turn.

Review findings first, ordered by severity. Check:

- Behavioral regressions and edge cases
- Missing or weak tests
- Safety, privacy, and fixture risks
- API, schema, CLI, and bundle-contract drift
- Runtime/generation coupling
- Overly broad changes, unnecessary dependencies, or needless complexity
- Unrelated file churn or accidental user-change edits

For larger modules, spawn read-only reviewer subagents for independent checks such as safety/privacy, tests/smoke, and architecture/contracts. Tell reviewers not to edit files.

If review finds issues:

1. Convert findings into fix tasks.
2. Patch the code.
3. Rerun relevant verification.
4. Review again.

Stop after 3 review/fix loops if the same class of issue remains unresolved. Report the blocker, evidence, and the next user decision needed.

## Auto Commit Gate

Only enter the commit gate when verification passes and review has no blocking findings. Commit automatically by default; the user should not need to send a separate commit prompt.

- Default: commit after the module passes verification and internal review.
- Do not commit only if the user explicitly says `commit: no`, "do not commit", "dry run", or equivalent.
- Before staging, rerun `git status --short`.
- Stage only files belonging to this module. Never stage unrelated user changes.
- Do not stop merely because unrelated untracked or modified files exist. Commit the task-owned path list with explicit `git add -- <paths>`.
- If task-owned files cannot be distinguished from unrelated user work, stop and report the ambiguity instead of guessing.
- Use a concise generated commit message. Prefer non-interactive git commands.
- If `git commit` fails because of git identity, hooks, or repository state, report the exact blocker and leave the verified changes in place.

## Final Response

Always report:

1. What changed
2. How verified, with exact command results
3. Internal review result
4. Commit hash, or the precise reason no commit was made
5. Remaining risks or skipped checks
6. Recommended next step
