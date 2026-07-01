<!-- codex-project-bootstrap:generated -->
# Guided App Quickstart

This page is the shortest path for running the guided desktop manager and checking that a generated pet can be launched and stopped.

Use `npm run dev:app` for the full product flow. Use `npm run dev` only when you want to launch the fixture directly in the lower-level runtime.

## Prerequisites

- Dependencies are installed with `npm install`.
- The source image is a local PNG or JPEG file.
- The source image is safe for local development. Do not commit personal photos or generated likenesses from manual runs.
- For the shortest local path, no API key is required.

## Shortest Local Path

1. Start the guided manager:

   ```bash
   npm run dev:app
   ```

2. Click `Select Image` and choose a local `.png`, `.jpg`, or `.jpeg`.

3. Keep `Generation` set to `Local`.

4. Optional: click `Style Compare`.

   Expected result: the app shows a style comparison contact sheet and three local preview images.

5. Click `Generate`.

   Expected result: the workflow reaches `Generated`, and the preview area can later show generated derived assets. The original source image is not copied into the pet bundle.

6. Click `QA Preview`.

   Expected result: the app shows `Preview`, `Sprite Sheet`, and QA check ids.

7. Click `Accept`.

   Expected result: the generated bundle is installed into the local app library and `Launch` becomes available.

8. Click `Launch`.

   Expected result: a transparent always-on-top desktop pet appears and animates. `Stop` becomes available.

9. Click `Stop`.

   Expected result: the desktop pet process exits, the workflow returns to the accepted state, and `Launch` becomes available again.

10. Optional cleanup: click `Delete Draft` and `Delete Accepted`.

## Mock Cloud Path

Mock cloud mode exercises the same upload-confirmation product path without making live network calls.

1. Start the app with a mock provider key:

   ```bash
   DOUDOU_MOCK_CLOUD_API_KEY=secret-test-key npm run dev:app
   ```

2. Select a local source image.

3. Set `Generation` to `Mock Cloud`.

4. Check `I confirm this source image may be sent to the selected provider.`

5. Continue with `Generate -> QA Preview -> Accept -> Launch -> Stop`.

Expected result: generation succeeds with `privacy.cloudGenerated:true` in the produced bundle, but the mock provider still performs no live upload.

## Direct Runtime Path

Use this only for runtime fixture debugging:

```bash
npm run dev
```

This bypasses the guided manager and launches `fixtures/pet_bundles/valid_minimal_atlas_pet` directly. Because the guided manager does not own this process, the in-app `Stop` button is not involved. Stop it with `Ctrl+C` in the terminal.

## Developer Smoke Checklist

Run the automated guided app smoke before relying on a manual run:

```bash
npm run smoke:app
```

The smoke should print `guided app smoke:` followed by JSON where these fields are true:

- `sourceSelected`
- `developerPreviewed`
- `developerPreviewContactSheetLoaded`
- `developerPreviewPreviewsLoaded`
- `generated`
- `reviewed`
- `previewLoaded`
- `contactSheetLoaded`
- `accepted`
- `launched`
- `cloudGenerated`
- `deletedDraft`
- `deletedAccepted`
- `runtimeSmoke.bundleLoaded`
- `runtimeSmoke.atlasLoaded`
- `runtimeSmoke.nonTransparentPixel`
- `runtimeSmoke.idleAdvanced`

Manual smoke checklist:

- Start `npm run dev:app`.
- Select a rights-safe local PNG/JPEG source image.
- Confirm the source filename appears, but no absolute source path is shown in the UI.
- Click `Style Compare` and confirm the contact sheet plus three preview images load.
- Use `Local` generation for the fastest manual check.
- Click `Generate`, then `QA Preview`.
- Confirm `Preview`, `Sprite Sheet`, and QA check ids render.
- Click `Accept`.
- Click `Launch` and confirm a desktop pet appears above the desktop.
- Click `Stop` and confirm the pet disappears.
- Click `Launch` again to confirm relaunch still works.
- Click `Stop` again.
- Click `Delete Draft` and `Delete Accepted` if you want to clean the local app workspace.

Optional process check after stopping:

```bash
ps -axo pid,ppid,command | grep -E 'dist/src/runtime/main\.js .*--bundle' | grep -v grep || true
```

Expected result: no matching runtime process remains.

## Troubleshooting

### `electron: command not found`

Run `npm install`, then retry `npm run dev:app`.

### App build or TypeScript errors before launch

Run the narrow checks first:

```bash
npm run typecheck
npm run build
```

If the error mentions stylizer defaults, run:

```bash
npm run lint
```

`npm run lint` includes the change-aware stylizer default gate.

### `Select Image` does not let you continue

Use a local PNG/JPEG file. Directories, remote URLs, unsupported formats, and unreadable files are rejected by source intake.

### `Generate` is disabled

Check these conditions:

- A source image is selected.
- `Local` mode is selected, or cloud mode has explicit upload confirmation.
- `Mock Cloud` mode has `DOUDOU_MOCK_CLOUD_API_KEY` in the app process environment.
- `OpenAI Live` mode is intentionally gated and needs `DOUDOU_ENABLE_OPENAI_LIVE=1`, `OPENAI_API_KEY`, and explicit upload confirmation.
- A desktop pet is not currently running. Click `Stop` before generating another pet.

### `QA Preview`, `Accept`, or `Launch` is disabled

The flow is sequential:

- `QA Preview` requires a generated draft bundle.
- `Accept` requires a generated draft bundle.
- `Launch` requires an accepted bundle and no currently running managed desktop pet.

### The desktop pet launches but is hard to see

Run the runtime smoke to verify the renderer can load and draw the pet:

```bash
npm run smoke:runtime
```

The expected evidence includes `bundleLoaded:true`, `atlasLoaded:true`, `nonTransparentPixel:true`, and `idleAdvanced:true`.

### `Stop` is disabled

`Stop` is only enabled for a runtime process launched from `npm run dev:app`. If you launched the fixture with `npm run dev`, stop it with `Ctrl+C` in that terminal.

### `Stop` does not appear to end the pet during development

First close the guided app; it also attempts to stop the managed runtime during app quit. Then check for a remaining process:

```bash
ps -axo pid,ppid,command | grep -E 'dist/src/runtime/main\.js .*--bundle' | grep -v grep
```

If a development process is still present, terminate that exact PID:

```bash
kill -TERM <pid>
```

Use `kill` only for the exact runtime PID you inspected.

### Automated smoke times out

Retry once after a clean build:

```bash
npm run build
npm run smoke:app
```

If it still fails, inspect the structured smoke JSON or timeout message. Avoid adding source paths, API keys, raw prompts, or provider responses to logs while debugging.
