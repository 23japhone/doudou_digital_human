<!-- codex-project-bootstrap:generated -->
# Agent Runtime


## Loop

This project may not need a conversational agent loop at first. The initial runtime loop is a pet behavior loop:

1. Observe desktop/runtime events: launch, timer tick, pointer hover, click/tap, drag, focus changes.
2. Select behavior: idle, blink, look-at-pointer, tap reaction, sleep, or error state.
3. Render frame: update animation, position, opacity, and hit area.
4. Verify health: detect missing assets, invalid manifests, or window/rendering failures.
5. Recover: fall back to a safe idle/default pet or stop with a clear error.

## State

Runtime state should include:

- Loaded pet bundle and schema version.
- Current behavior state and animation frame.
- Window position, scale, monitor, and z-order preference.
- User preferences such as mute, launch-at-login, and click-through mode.
- Runtime logs with no source image bytes or secrets.

Long-term memory and chat state are out of scope until the basic desktop pet is reliable.

## Failure Handling

- Invalid bundle: show validation errors and refuse to launch.
- Missing asset: use a placeholder only in development; release builds should fail clearly.
- Render failure: restart the runtime once, then stop and surface logs.
- Model/generation failure: preserve the source project state and allow retry without duplicating large temporary files.
