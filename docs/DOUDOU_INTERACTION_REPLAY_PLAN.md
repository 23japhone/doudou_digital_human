# 兜兜桌宠交互 Replay 计划

Date: 2026-07-04

Status: replay script and runtime smoke preflight landed

Source contract: `docs/DOUDOU_INTERACTION_STATE_BUS.md`

Owning domain: `src/runtime/`, `tests/runtime/`, `fixtures/runtime/`

## 目标

本文把 `docs/DOUDOU_INTERACTION_STATE_BUS.md` 中的交互状态总线转成最小 replay fixtures 和验收指标。第一版 replay 的目标不是替代 Electron smoke，而是把兜兜桌宠的核心可爱互动变成可重复、可审查、可扩展的回放合同。

最小覆盖范围：

- `single-poke`: 单次可见 alpha 戳戳。
- `repeat-poke-retreat-watch`: 连续戳后短期 wariness、后退和观察。
- `quiet-recovery`: 安静后从委屈或鼓脸自然恢复。
- `working-drag`: 拖拽期间进入低干扰工作态。
- `working-scale`: 缩放期间进入低干扰工作态。
- `privacy-trace`: 任何 replay trace 都不得泄漏路径、prompt、provider payload 或秘密。

首个 pure runner 已落在 `src/runtime/interaction-replay.ts`，六个最小 JSON fixtures 已落在 `fixtures/runtime/interaction_replay/`，测试入口是 `tests/runtime/interaction-replay.test.ts`。团队快速入口是 `npm run replay:runtime`；`npm run smoke:runtime` 已在启动 Electron 证据前复用同一批 fixtures 做 replay preflight。

## 非目标

- 不修改 `pet bundle v0.1`。
- 不要求新增 sprite atlas 帧或 animation name。
- 不启动真实 Electron 窗口，不依赖全局鼠标位置，也不读取真实屏幕内容。
- 不接入 LLM/VLM、云服务、摄像头、麦克风或长期关系记忆。
- 不保存 source image、source path、raw prompt、raw provider response、provider endpoint、API key 或本地绝对路径。

## 现有依据

Replay 应复用当前 runtime 的稳定事实：

- `src/runtime/state.ts` 已有 `RuntimePetState`、state timing、`tap()`、`working()` 和 motion cue 行为。
- `src/runtime/reaction.ts` 已有 `wariness`、alpha reaction、`retreating` / `watching` / `recovering` phase。
- `src/runtime/default-doudou-emotions.ts` 已有 runtime scenario 到默认兜兜 emotion id 的映射。
- `npm run smoke:runtime` 已观察 runtime states、default 兜兜 scenarios、emotion ids、tap frames、wariness 和 passive cursor movement evidence。

第一版 replay runner 应优先运行纯函数和轻量 adapter，不依赖 renderer DOM。Electron smoke 继续负责透明窗口、canvas alpha、drag/scale 和真实渲染证据。

## Fixture 位置

Fixture 放在：

```text
fixtures/runtime/interaction_replay/*.json
```

测试放在：

```text
tests/runtime/interaction-replay.test.ts
```

后续新增 replay 时，不应把 replay fixtures 放到 flat root，也不应和 pet bundle fixtures 混在一起。

## Fixture Schema

每个 replay fixture 是一个确定性的 JSON 文件，只记录 fixed enum、有限数值和 synthetic pointer data。

```json
{
  "schemaVersion": "doudou.interaction-replay.v0.1",
  "id": "single-poke",
  "titleZh": "单次戳戳",
  "initial": {
    "state": "waiting",
    "wariness": 0,
    "atMs": 0
  },
  "events": [
    {
      "atMs": 1000,
      "type": "poke",
      "target": "visible_alpha",
      "point": { "canvasX": 128, "canvasY": 116 }
    }
  ],
  "expect": {
    "statesInclude": ["poked"],
    "scenariosInclude": ["tap"],
    "emotionIdsInclude": ["surprised"],
    "reactionActsInclude": ["poke_pop"],
    "finalState": "waiting"
  }
}
```

字段规则：

- `schemaVersion` 固定为 `doudou.interaction-replay.v0.1`。
- `id` 使用 kebab-case，必须和文件名一致。
- `titleZh` 使用中文，用户可读文案写“兜兜”，不得使用其他同音误写。
- `initial.state` 必须是 `RuntimePetState`。
- `initial.wariness` 必须在 `0..1`。
- `events[*].atMs` 必须单调递增。
- `events[*].type` 必须来自状态总线合同中的 `PetInteractionEventType`，或者来自本文明确允许的 synthetic replay extension。
- `expect` 只使用可断言的 enum、布尔值和有限数值，不包含截图、路径或私密数据。

允许的 synthetic replay extension：

| Event Type | 用途 | 约束 |
| --- | --- | --- |
| `motion_cue` | 直接喂给 state machine，用于验证 state handoff | 只允许 `approaching`、`dodging`、`retreating`、`stopped`、`watching` |
| `advance_time` | 推进 state machine timing | 不产生用户输入，不写 memory |
| `assert_trace` | 触发中间断言点 | 只用于测试 runner，不进入 runtime |

这些 extension 是 runner 内部事件，不是产品 runtime IPC，也不进入 `pet bundle v0.1`。

## Trace 输出

Replay runner 的输出应对齐状态总线中的 `PetInteractionTraceEntry`，并补充 fixture-level summary。

```ts
export interface PetInteractionReplayResult {
  id: string;
  ok: boolean;
  observed: {
    states: RuntimePetState[];
    scenarios: DefaultDoudouEmotionScenario[];
    emotionIds: DefaultDoudouEmotionId[];
    reactionActs: PetReactionAct[];
    motionPhases: RuntimeEmotionMotionPhase[];
    maxWariness: number;
    tapReactFrameObserved: boolean;
    passiveCursorMovedWindow: boolean;
  };
  final: {
    state: RuntimePetState;
    scenario: DefaultDoudouEmotionScenario;
    emotionId: DefaultDoudouEmotionId;
    wariness: number;
  };
  failedChecks: PetInteractionReplayFailureCode[];
}
```

固定失败码：

```ts
export type PetInteractionReplayFailureCode =
  | "missing_state"
  | "missing_scenario"
  | "missing_emotion_id"
  | "missing_reaction_act"
  | "missing_motion_phase"
  | "wariness_too_low"
  | "wariness_not_recovered"
  | "state_stolen_during_working"
  | "passive_cursor_moved_window"
  | "trace_privacy_leak"
  | "invalid_fixture_schema";
```

失败输出必须只包含 fixture id、失败码和 public enum evidence，不能打印本地路径、raw event payload 之外的用户数据、prompt 或 provider 信息。

## 最小 Fixtures

### 1. `single-poke`

目的：证明一次可见 alpha 戳戳只触发短时惊讶，不进入 repeat-poke 退避。

输入事件：

```json
[
  { "atMs": 0, "type": "runtime_started", "target": "runtime" },
  { "atMs": 1000, "type": "poke", "target": "visible_alpha", "point": { "canvasX": 128, "canvasY": 116 } },
  { "atMs": 1420, "type": "advance_time", "target": "runtime" }
]
```

必须观察到：

- states include `poked` and final `waiting`。
- scenarios include `tap`。
- emotion ids include `surprised`。
- reaction acts include `poke_pop`。
- `tapReactFrameObserved` 为 `true`，或 pure runner 中的 pose `clickExpression` 为 `tap_react`。
- `maxWariness` 大于 `0`，但低于 repeat-poke threshold。

不得出现：

- `retreating`、`watching`、`repeat_poke_retreat`、`repeat_poke_watch`。
- 长期记忆写入或 bundle schema 变更。

### 2. `repeat-poke-retreat-watch`

目的：证明连续戳戳会产生短期 wariness，并映射为后退和观察。

输入事件：

```json
[
  { "atMs": 0, "type": "runtime_started", "target": "runtime" },
  { "atMs": 1000, "type": "poke", "target": "visible_alpha", "point": { "canvasX": 128, "canvasY": 116 } },
  { "atMs": 1300, "type": "poke", "target": "visible_alpha", "point": { "canvasX": 128, "canvasY": 116 } },
  { "atMs": 1450, "type": "assert_trace", "target": "runtime" },
  { "atMs": 1850, "type": "assert_trace", "target": "runtime" }
]
```

必须观察到：

- `maxWariness >= waryDodgeThreshold`。
- motion phases include `retreating` and `watching`。
- states include `retreating` and `watching`。
- scenarios include `repeat_poke_retreat` and `repeat_poke_watch`。
- emotion ids include `annoyed_pout` and `teary`。
- reaction acts include `repeat_poke_retreat` and `repeat_poke_watch`。

不得出现：

- `wariness > 1`。
- 攻击性、惩罚性或长期不可恢复状态。

### 3. `quiet-recovery`

目的：证明连续戳后的安静期会自然恢复，而不是持续委屈或持续躲避。

输入事件：

```json
[
  { "atMs": 0, "type": "runtime_started", "target": "runtime" },
  { "atMs": 1000, "type": "poke", "target": "visible_alpha", "point": { "canvasX": 128, "canvasY": 116 } },
  { "atMs": 1300, "type": "poke", "target": "visible_alpha", "point": { "canvasX": 128, "canvasY": 116 } },
  { "atMs": 2450, "type": "quiet_tick", "target": "runtime" },
  { "atMs": 4400, "type": "quiet_tick", "target": "runtime" },
  { "atMs": 8200, "type": "quiet_tick", "target": "runtime" }
]
```

必须观察到：

- motion phases include `recovering` and final `settled`。
- scenarios include `quiet_recovery`。
- emotion ids include `comfort_soft`。
- reaction acts include `quiet_recovery`。
- final state is `waiting`。
- final emotion id is `calm_idle` 或 `comfort_soft -> calm_idle` transition summary。
- final `wariness` 小于 repeat-poke 后的 peak，建议低于 `0.2`。

不得出现：

- final state 仍是 `retreating` 或 `watching`。
- repeat-poke 状态被写成长期用户画像。

### 4. `working-drag`

目的：证明拖拽窗口期间进入 `working`，普通 motion cue 不会抢占工作态。

输入事件：

```json
[
  { "atMs": 0, "type": "runtime_started", "target": "runtime" },
  { "atMs": 1000, "type": "drag_started", "target": "interaction_frame" },
  { "atMs": 1060, "type": "motion_cue", "target": "runtime", "state": "approaching", "direction": "right", "motionIntensity": 0.8 },
  { "atMs": 1120, "type": "drag_ended", "target": "interaction_frame" },
  { "atMs": 1520, "type": "advance_time", "target": "runtime" }
]
```

必须观察到：

- states include `working`。
- scenarios include `working`。
- emotion ids include `focused_working`。
- reaction acts include `work_hold`。
- `state_stolen_during_working` 不得出现。
- `maxWariness` remains `0`。
- final state returns to `waiting` after working hold expires。

不得出现：

- drag 期间由普通 `motion_cue` 切到 `approaching`、`dodging` 或 `retreating`。
- 因拖拽增加 `wariness`。

### 5. `working-scale`

目的：证明缩放期间也进入低干扰工作态，并且不把缩放误判成戳戳或重复戳。

输入事件：

```json
[
  { "atMs": 0, "type": "runtime_started", "target": "runtime" },
  { "atMs": 1000, "type": "scale_started", "target": "interaction_frame" },
  { "atMs": 1080, "type": "scale_changed", "target": "interaction_frame" },
  { "atMs": 1160, "type": "cursor_alpha_entered", "target": "visible_alpha" },
  { "atMs": 1240, "type": "scale_ended", "target": "interaction_frame" },
  { "atMs": 1760, "type": "advance_time", "target": "runtime" }
]
```

必须观察到：

- states include `working`。
- scenarios include `working`。
- emotion ids include `focused_working`。
- policy motion budget is `low`。
- reaction acts include `work_hold`。
- `maxWariness` remains `0`。
- no `tap`、`repeat_poke_retreat` or `repeat_poke_watch`。

不得出现：

- 缩放中的 cursor contact 被当成 `poke`。
- 缩放期间普通 cursor cue 抢占 `working`。

### 6. `privacy-trace`

目的：证明所有 replay trace 都是 sanitized evidence。

输入事件：

```json
[
  { "atMs": 0, "type": "assert_trace", "target": "runtime" }
]
```

这个 fixture 可以作为 meta-gate：runner 加载全部 interaction replay results 后，对每条 trace 和 summary 运行 privacy scan。

必须观察到：

- trace 只包含 fixed enum、布尔值、有限数值、fixture id 和 relative fixture filename。
- 没有 source image、source path、absolute path、`file://`、remote URL、raw prompt、raw model response、provider endpoint、provider payload、API key、token、secret、screen text、window title。
- trace 不包含用户输入文本或个人照片派生内容。

失败时：

- 返回 `trace_privacy_leak`。
- 输出只显示固定失败码和字段名，不回显敏感值。

## 验收指标

每个 replay fixture 至少有三层验收。

### Fixture Schema

- `schemaVersion` 正确。
- `id`、文件名、`titleZh` 存在。
- `events` 非空，`atMs` 单调递增。
- `initial.wariness` 和所有 observed wariness 在 `0..1`。
- 事件类型属于状态总线或本文 synthetic extension。
- `expect` 字段只包含 allowlisted assertion keys。

### 行为证据

- Required states、scenarios、emotion ids、reaction acts 全部被观察到。
- Required motion phases 全部被观察到。
- Final state 和 final emotion 符合 fixture 目标。
- `single-poke` 不进入 repeat-poke states。
- `repeat-poke-retreat-watch` 达到 `waryDodgeThreshold`。
- `quiet-recovery` 证明 wariness 下降并最终 settled。
- `working-drag` 和 `working-scale` 证明普通 motion cue 不抢占 `working`。
- Passive cursor contact 不移动 overlay window；pure runner 里该字段固定为 `false`，Electron smoke 继续提供真实证明。

### 隐私证据

- Replay fixture、trace、summary 和 failure output 不包含本地绝对路径。
- 不包含 source image、prompt、provider payload、secret、token 或 raw response。
- 不包含真实 screen text、window title、摄像头、麦克风或用户私密文本。
- Fixture 使用 synthetic point/timing，不依赖个人图像或生成 likeness。

## Runner 实现建议

第一版 runner 可以是纯 runtime 单元测试，不启动 Electron：

1. 读取 fixture JSON。
2. 初始化 `createRuntimePetStateMachine()` 和 `createRuntimeEmotionMemory()`。
3. 按 `events[*].atMs` 顺序执行：
   - `poke` 调用 `recordRuntimePokeEmotion()`、state machine `tap()`，并根据 phase 推导 `repeat_poke_retreat` / `repeat_poke_watch`。
   - `quiet_tick` 调用 `decayRuntimeEmotionMemory()` 和 `classifyRuntimeEmotionMotionPhase()`。
   - `drag_started`、`scale_started`、`scale_changed` 调用 state machine `working()`。
   - `motion_cue` 调用 state machine `motion()`，但验证 `working` 和 `poked` 的抢占保护。
   - `advance_time` 调用 state machine `advance()`。
4. 每步生成 `PetInteractionTraceEntry`。
5. 从 trace 汇总 `PetInteractionReplayResult`。
6. 对 `expect` 和 privacy gate 断言。

当前 Electron smoke 已复用同一批 fixture 做轻量 replay preflight。未来如果需要更细的 Electron 层事件回放，可以再把 synthetic events 映射成 renderer/main IPC smoke interactions，但不应替代现有窗口、canvas、drag/scale 和渲染 evidence。

## 与现有检查的关系

| 检查 | 责任 |
| --- | --- |
| `tests/runtime/state.test.ts` | 保护状态机基本 transition |
| `tests/runtime/reaction.test.ts` | 保护 wariness、alpha reaction 和 phase |
| `tests/runtime/default-doudou-emotions.test.ts` | 保护 scenario 到 emotion id |
| `tests/runtime/interaction-replay.test.ts` | 串起 event -> trace -> acceptance |
| `npm run replay:runtime` | 读取六个 JSON fixtures 并输出脱敏 replay summary |
| `npm run smoke:runtime` | 先执行 replay preflight，再证明真实 Electron runtime、canvas、drag/scale、窗口和渲染 evidence |

Replay tests 不应该替代 smoke；它们负责让行为合同更快、更细、更容易定位。

## 文件和命令建议

当前已落地：

```text
fixtures/runtime/interaction_replay/single-poke.json
fixtures/runtime/interaction_replay/repeat-poke-retreat-watch.json
fixtures/runtime/interaction_replay/quiet-recovery.json
fixtures/runtime/interaction_replay/working-drag.json
fixtures/runtime/interaction_replay/working-scale.json
fixtures/runtime/interaction_replay/privacy-trace.json
src/runtime/interaction-replay.ts
src/scripts/runtime-interaction-replay.ts
tests/runtime/interaction-replay.test.ts
tests/scripts/runtime-interaction-replay.test.ts
```

建议命令：

```text
npm test -- tests/runtime/interaction-replay.test.ts
npm test -- tests/runtime/state.test.ts tests/runtime/reaction.test.ts tests/runtime/default-doudou-emotions.test.ts
npm run replay:runtime
npm run smoke:runtime
```

`npm run replay:runtime` 只负责快速 pure replay summary；`npm run smoke:runtime` 仍负责 Electron runtime 真实窗口和 renderer evidence，并把 replay summary 作为前置失败点输出。

## Review 清单

实现 replay runner 或 fixture 时，review 至少检查：

- 是否覆盖全部六个最小 fixtures。
- 是否保持 `pet bundle v0.1` 不变。
- 是否只使用 runtime-only state 和 synthetic replay input。
- 是否把 `poke`、`repeat_poke_retreat`、`repeat_poke_watch`、`quiet_recovery`、`working` 都变成可断言 evidence。
- 是否证明 `working` 不被普通 motion cue 抢占。
- 是否证明 `wariness` 能上升、clamp、衰减和恢复。
- 是否没有 source path、raw prompt、provider payload、token、secret、absolute path、remote URL、screen text 或 window title 泄漏。
- 是否把失败输出限制为 fixed failure codes 和 public enum evidence。

## 推荐下一步

1. 后续新增交互场景时，先加 JSON fixture，再扩展 `src/runtime/interaction-replay.ts` 的 allowlist 和断言。
2. 如需更接近真实 DOM/IPC 的 replay，再为 `smoke:runtime` 增加可选 synthetic event adapter。
3. 保持 `npm run replay:runtime` 输出为脱敏 summary，不输出逐步 trace 或本机路径。
