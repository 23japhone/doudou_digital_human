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

2. Click `选择图片` and choose a local `.png`, `.jpg`, or `.jpeg`.

3. Keep `生成设置` set to `本地`.

4. Optional: click `风格对比`.

   Expected result: the app shows a style comparison contact sheet and three local preview images.

5. Click `生成`.

   Expected result: the workflow reaches `已生成`, and the preview area can later show generated derived assets. The original source image is not copied into the pet bundle.

6. Click `预览检查`.

   Expected result: the app shows `预览图`, `精灵图集`, and QA check ids.

7. Click `接受`.

   Expected result: the generated bundle is installed into the local app library and `启动` becomes available. If an older generated bundle with the same pet id is already in the app library, the guided manager replaces that old app-library copy with the current accepted draft.

8. Click `启动`.

   Expected result: a transparent always-on-top desktop pet appears and animates. Drag the visible pet body with the primary mouse button to move it. `停止` becomes available.

9. Click `停止`.

   Expected result: the desktop pet process exits, the workflow returns to the accepted state, and `启动` becomes available again.

10. Optional cleanup: click `删除草稿` and `删除已接受`.

    Expected result: derived app assets are removed and the selected source filename returns to `未选择图片`. The original local image file is not deleted from disk.

## Mock Cloud Path

Mock cloud mode exercises the same upload-confirmation product path without making live network calls.

1. Start the app with a mock provider key:

   ```bash
   DOUDOU_MOCK_CLOUD_API_KEY=secret-test-key npm run dev:app
   ```

2. Select a local source image.

3. Set `生成设置` to `模拟云`.

4. Check `我确认可以将这张源图片发送给所选提供方。`

5. Continue with `生成 -> 预览检查 -> 接受 -> 启动 -> 停止`.

Expected result: generation succeeds with `privacy.cloudGenerated:true` in the produced bundle, but the mock provider still performs no live upload.

## Direct Runtime Path

Use this only for runtime fixture debugging:

```bash
npm run dev
```

This bypasses the guided manager and launches `fixtures/pet_bundles/valid_minimal_atlas_pet` directly. Because the guided manager does not own this process, the in-app `停止` button is not involved. Stop it with `Ctrl+C` in the terminal.

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
- Click `风格对比` and confirm the contact sheet plus three preview images load.
- Use `本地` generation for the fastest manual check.
- Click `生成`, then `预览检查`.
- Confirm `预览图`, `精灵图集`, and QA check ids render.
- Click `接受`.
- Click `启动` and confirm a desktop pet appears above the desktop.
- Drag the visible pet body and confirm the desktop pet window follows the pointer.
- Click `停止` and confirm the pet disappears.
- Click `启动` again to confirm relaunch still works.
- Click `停止` again.
- Click `删除草稿` and `删除已接受` if you want to clean the local app workspace.
- Confirm the selected source filename is cleared after cleanup, while the original local image file remains on disk.

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

### `选择图片` does not let you continue

Use a local PNG/JPEG file. Directories, remote URLs, unsupported formats, and unreadable files are rejected by source intake.

### `生成` is disabled

Check these conditions:

- A source image is selected.
- `本地` mode is selected, or cloud mode has explicit upload confirmation.
- `模拟云` mode has `DOUDOU_MOCK_CLOUD_API_KEY` in the app process environment.
- `OpenAI 实时` mode is intentionally gated and needs `DOUDOU_ENABLE_OPENAI_LIVE=1`, `OPENAI_API_KEY`, and explicit upload confirmation.
- A desktop pet is not currently running. Click `停止` before generating another pet.

### `预览检查`, `接受`, or `启动` is disabled

The flow is sequential:

- `预览检查` requires a generated draft bundle.
- `接受` requires a generated draft bundle.
- `启动` requires an accepted bundle and no currently running managed desktop pet.

### The desktop pet launches but is hard to see

Run the runtime smoke to verify the renderer can load and draw the pet:

```bash
npm run smoke:runtime
```

The expected evidence includes `bundleLoaded:true`, `atlasLoaded:true`, `nonTransparentPixel:true`, and `idleAdvanced:true`.

### `停止` is disabled

`停止` is only enabled for a runtime process launched from `npm run dev:app`. If you launched the fixture with `npm run dev`, stop it with `Ctrl+C` in that terminal.

### `停止` does not appear to end the pet during development

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
